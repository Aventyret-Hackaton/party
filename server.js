// Servern på Heroku: visar spelet och sparar det gemensamma galleriet.
//
// Galleriet sparas i Heroku Postgres (miljövariabeln DATABASE_URL, som Heroku sätter
// när databasen läggs till). Saknas databasen sparas bilderna bara i minnet och
// försvinner när servern startar om, till exempel vid varje deploy.
//
// API:
//   GET   /api/health          – finns servern, och var sparas bilderna?
//   GET   /api/gallery         – de senaste gubbarna (?since=id: bara de som är nyare än id)
//   POST  /api/gallery         – spara en ny gubbe, svarar med id och en nyckel
//   PATCH /api/gallery/:id     – byt namn, kräver nyckeln från POST
//   GET   /api/gallery/:id     – en gubbe eller gruppbild (för delade länkar)
//   /api/admin/...             – adminläget: radera och byta namn, se admin-server.js
//   GET   /api/gallery/:id.svg – gubben som tryckbar SVG för Tryckskaparen, se tryck-svg.js
//   PUT   /api/gallery/:id/voice – spara gubbens catchphrase (ljud), kräver nyckeln i X-Token
//   GET   /api/gallery/:id/voice – spela upp catchphrasen
//   /api/games/...             – onlinespel, se online-server.js

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const MAX_BODY = 1024 * 1024;     // största tillåtna gubbe (eller gruppbild från power-läget) i byte
const LIST_LIMIT = 300;           // hur många gubbar galleriet visar (spelet visar dem en sida i taget)
const POSTS_PER_HOUR = 40;        // per IP-adress, mot spam
const MAX_VOICE = 300 * 1024;     // största catchphrase i byte (sex sekunder brukar vara 30–60 kB)

/* ---------- Lagring ---------- */
let pool = null;
const memory = [];               // används bara om databasen saknas
let nextMemId = 1;

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL saknas. Galleriet sparas bara i minnet.");
    return;
  }
  const { Pool } = require("pg");
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pool.query(`CREATE TABLE IF NOT EXISTS gallery (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    token_hash TEXT NOT NULL,
    data JSONB NOT NULL
  )`);
  // Catchphrasen ligger i en egen tabell, så att listan med gubbar inte blir tung att hämta
  await pool.query(`CREATE TABLE IF NOT EXISTS gallery_voice (
    id BIGINT PRIMARY KEY REFERENCES gallery(id) ON DELETE CASCADE,
    mime TEXT NOT NULL,
    audio BYTEA NOT NULL
  )`);
  console.log("Galleriet sparas i Postgres.");
}

const hash = s => crypto.createHash("sha256").update(String(s)).digest("hex");

async function getGallery(id) {
  if (pool) {
    const r = await pool.query("SELECT data FROM gallery WHERE id = $1", [id]);
    return r.rows[0] ? r.rows[0].data : null;
  }
  const m = memory.find(x => x.id === id);
  return m ? m.data : null;
}
// since: bara gubbar med högre id än så (nya sedan förra hämtningen)
async function listGallery(since = 0) {
  if (pool) {
    const r = await pool.query("SELECT id, created_at, data FROM gallery WHERE id > $2 ORDER BY id DESC LIMIT $1", [LIST_LIMIT, since]);
    return r.rows.map(row => ({ ...row.data, id: String(row.id), createdAt: row.created_at.toISOString() }));
  }
  return memory.filter(m => +m.id > since).slice(0, LIST_LIMIT).map(m => ({ ...m.data, id: m.id, createdAt: m.createdAt }));
}
async function addGallery(data) {
  const token = crypto.randomBytes(18).toString("base64url");
  if (pool) {
    const r = await pool.query("INSERT INTO gallery (token_hash, data) VALUES ($1, $2) RETURNING id", [hash(token), data]);
    return { id: String(r.rows[0].id), token };
  }
  const id = String(nextMemId++);
  memory.unshift({ id, tokenHash: hash(token), createdAt: new Date().toISOString(), data });
  return { id, token };
}
async function renameGallery(id, token, name) {
  if (pool) {
    const r = await pool.query(
      "UPDATE gallery SET data = jsonb_set(data, '{name}', to_jsonb($3::text)) WHERE id = $1 AND token_hash = $2",
      [id, hash(token), name]);
    return r.rowCount > 0;
  }
  const m = memory.find(x => x.id === id && x.tokenHash === hash(token));
  if (m) m.data.name = name;
  return !!m;
}

// Adminläget: radera för alltid. Ljudet (gallery_voice) försvinner med, ON DELETE CASCADE.
async function deleteGallery(id) {
  if (pool) return (await pool.query("DELETE FROM gallery WHERE id = $1", [id])).rowCount > 0;
  const i = memory.findIndex(x => x.id === id);
  if (i >= 0) memory.splice(i, 1);
  return i >= 0;
}
async function adminRename(id, name) {
  if (pool) return (await pool.query("UPDATE gallery SET data = jsonb_set(data, '{name}', to_jsonb($2::text)) WHERE id = $1", [id, name])).rowCount > 0;
  const m = memory.find(x => x.id === id);
  if (m) m.data.name = name;
  return !!m;
}

// Catchphrase: bara den som sparade gubben (med nyckeln) får lägga till ljud
async function setVoice(id, token, mime, buf) {
  if (pool) {
    const ok = await pool.query("SELECT 1 FROM gallery WHERE id = $1 AND token_hash = $2", [id, hash(token)]);
    if (!ok.rowCount) return false;
    await pool.query(`INSERT INTO gallery_voice (id, mime, audio) VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET mime = EXCLUDED.mime, audio = EXCLUDED.audio`, [id, mime, buf]);
    await pool.query("UPDATE gallery SET data = jsonb_set(data, '{voice}', 'true') WHERE id = $1", [id]);
    return true;
  }
  const m = memory.find(x => x.id === id && x.tokenHash === hash(token));
  if (!m) return false;
  m.voice = { mime, buf }; m.data.voice = true;
  return true;
}
async function getVoice(id) {
  if (pool) {
    const r = await pool.query("SELECT mime, audio FROM gallery_voice WHERE id = $1", [id]);
    return r.rows[0] ? { mime: r.rows[0].mime, buf: r.rows[0].audio } : null;
  }
  const m = memory.find(x => x.id === id);
  return m && m.voice ? m.voice : null;
}

/* ---------- Kontroll av det som skickas in ---------- */
const str = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
function cleanStroke(s) {
  if (!s || !Array.isArray(s.p) || s.p.length < 2 || s.p.length > 20000) return null;
  if (!s.p.every(n => typeof n === "number" && isFinite(n))) return null;
  const w = Number(s.w);
  if (!(w > 0 && w <= 100)) return null;
  const out = { p: s.p.map(n => Math.round(n * 10) / 10), w };
  if (s.e) out.e = true;
  else if (typeof s.c === "string" && /^#[0-9a-f]{6}$/i.test(s.c)) out.c = s.c;
  else return null;
  return out;
}
// Delarna i en gubbe: [{ s: [penndrag] }, ...], 3–6 delar
function cleanParts(list) {
  if (!Array.isArray(list) || list.length < 3 || list.length > 6) return null;
  const parts = [];
  for (const pt of list) {
    if (!pt || !Array.isArray(pt.s) || pt.s.length > 3000) return null;
    parts.push({ s: pt.s.map(cleanStroke).filter(Boolean) });
  }
  return parts;
}
// En gruppbild från power-läget: 3–6 gubbar som sparas tillsammans, med gängets namn.
// figs: [[{ s }, ...], ...], by: vilka som ritade varje gubbe
function cleanGroup(b) {
  if (!Array.isArray(b.figs) || b.figs.length < 3 || b.figs.length > 6) return null;
  const figs = b.figs.map(cleanParts);
  if (figs.some(f => !f)) return null;
  const names = list => Array.isArray(list) ? list.slice(0, 6).map(n => str(n, 40)) : [];
  return {
    kind: "group", name: str(b.name, 80), dir: b.dir, figs, home: str(b.home, 60),
    by: figs.map((_, i) => names(Array.isArray(b.by) ? b.by[i] : [])), names: names(b.names),
    staff: "", mode: "online"
  };
}
function cleanRecord(b) {
  if (!b || typeof b !== "object") return null;
  if (b.dir !== "v" && b.dir !== "h") return null;
  if (b.kind === "group") return cleanGroup(b);
  if (!Array.isArray(b.parts) || b.parts.length < 3 || b.parts.length > 6) return null;
  const parts = [];
  for (const pt of b.parts) {
    if (!pt || !Array.isArray(pt.s) || pt.s.length > 3000) return null;
    parts.push({ s: pt.s.map(cleanStroke).filter(Boolean) });
  }
  return {
    name: str(b.name, 80),
    what: str(b.what, 60),
    dir: b.dir,
    parts,
    home: str(b.home, 60),
    names: Array.isArray(b.names) ? b.names.slice(0, 6).map(n => str(n, 40)) : [],
    staff: str(b.staff, 40),
    gang: str(b.gang, 80),   // gänget, om gubben ritades i power-läget
    mode: b.mode === "online" ? "online" : "room"
  };
}

/* ---------- Enkel spärr mot spam ---------- */
const posts = new Map();
function allowPost(ip) {
  const now = Date.now(), list = (posts.get(ip) || []).filter(t => now - t < 3600e3);
  if (list.length >= POSTS_PER_HOUR) { posts.set(ip, list); return false; }
  list.push(now); posts.set(ip, list);
  return true;
}

/* ---------- Svar ---------- */
// Versionen av spelet: en kontrollsumma av koden, räknad när servern startar. Skickas med varje svar,
// så att en telefon som har en gammal version öppen kan säga till (js/online.js).
const APP_VERSION = (() => {
  const h = crypto.createHash("sha256");
  const walk = d => fs.readdirSync(path.join(__dirname, d), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .forEach(e => e.isDirectory() ? walk(path.join(d, e.name)) : h.update(fs.readFileSync(path.join(__dirname, d, e.name))));
  try { h.update(fs.readFileSync(path.join(__dirname, "index.html"))); walk("css"); walk("js"); } catch (e) {}
  return h.digest("hex").slice(0, 12);
})();
function send(req, res, status, body, type = "application/json; charset=utf-8", extra = {}) {
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  const headers = { "Content-Type": type, "X-Content-Type-Options": "nosniff", "X-App-Version": APP_VERSION, "X-Now": String(Date.now()), ...extra };
  if (buf.length > 1024 && /\bgzip\b/.test(req.headers["accept-encoding"] || "") && /json|text|javascript|svg/.test(type)) {
    buf = zlib.gzipSync(buf); headers["Content-Encoding"] = "gzip"; headers["Vary"] = "Accept-Encoding";
  }
  headers["Content-Length"] = buf.length;
  res.writeHead(status, headers);
  res.end(req.method === "HEAD" ? undefined : buf);
}
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > max) return;               // läs klart utan att spara, så att svaret 413 hinner fram
      chunks.push(c);
    });
    req.on("end", () => size > max ? reject(Object.assign(new Error("too large"), { status: 413 })) : resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error("too large"), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (e) { reject(Object.assign(e, { status: 400 })); } });
    req.on("error", reject);
  });
}

/* ---------- Statiska filer: bara spelets egna mappar ---------- */
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".wav": "audio/wav"
};
const PUBLIC = ["css", "js", "assets"];
function serveStatic(req, res, pathname) {
  if (pathname === "/") pathname = "/index.html";
  const rel = path.normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, "");
  const top = rel.split(/[/\\]/)[0];
  if (rel !== "index.html" && !PUBLIC.includes(top)) return send(req, res, 404, "Hittades inte", "text/plain; charset=utf-8");
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) return send(req, res, 404, "Hittades inte", "text/plain; charset=utf-8");
  fs.readFile(file, (err, data) => {
    if (err) return send(req, res, 404, "Hittades inte", "text/plain; charset=utf-8");
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    // Kod och sidan kontrolleras alltid på nytt, så att en ny deploy aldrig blandas med gamla filer.
    // Bilder och ljud i assets/ får sparas en stund.
    const cache = { "Cache-Control": top === "assets" ? "public, max-age=300" : "no-cache", "Accept-Ranges": "bytes" };
    // Notis-hjälpen (js/sw.js) får gälla hela sidan, inte bara mappen js/
    if (rel.replace(/\\/g, "/") === "js/sw.js") cache["Service-Worker-Allowed"] = "/";
    // Safari på iPhone hämtar ljud i bitar (Range) och spelar inte upp det annars
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (range && /^audio\//.test(type)) {
      let start = range[1] ? +range[1] : data.length - +range[2], end = range[1] && range[2] ? +range[2] : data.length - 1;
      if (!range[1] && !range[2] || start < 0 || start >= data.length || end < start) {
        res.writeHead(416, { "Content-Range": `bytes */${data.length}` }); return res.end();
      }
      end = Math.min(end, data.length - 1);
      return send(req, res, 206, data.subarray(start, end + 1), type, { ...cache, "Content-Range": `bytes ${start}-${end}/${data.length}` });
    }
    send(req, res, 200, data, type, cache);
  });
}

/* ---------- Onlinespel, se online-server.js ---------- */
const handleGames = require("./online-server.js")({ send, readJson, str, cleanStroke });
const { pushKey } = require("./push-server.js");
const { figureSvg } = require("./tryck-svg.js");
const handleAdmin = require("./admin-server.js")({ send, readJson, str, deleteGallery, adminRename });
const TRYCK_ORIGIN = "https://tryckskaparen.tifosi.se";
const MAX_SVG = 2 * 1024 * 1024;   // Tryckskaparen tar emot högst 2 MB

/* ---------- Routning ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  try {
    if (p === "/api/health" && req.method === "GET") {
      return send(req, res, 200, { ok: true, storage: pool ? "postgres" : "memory", online: true, password: !!process.env.ONLINE_PASSWORD, pushKey: pushKey() });
    }
    if (p === "/api/gallery" && req.method === "GET") {
      const since = Math.max(0, Math.floor(+url.searchParams.get("since") || 0));
      return send(req, res, 200, await listGallery(since), undefined, { "Cache-Control": "no-store" });
    }
    if (p === "/api/gallery" && req.method === "POST") {
      const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      if (!allowPost(ip)) return send(req, res, 429, { error: "För många gubbar på kort tid. Vänta en stund." });
      const rec = cleanRecord(await readJson(req));
      if (!rec) return send(req, res, 400, { error: "Gubben gick inte att läsa." });
      return send(req, res, 201, await addGallery(rec));
    }
    // Gubben som SVG till Tryckskaparen. Bara Tryckskaparen får hämta den från en annan sida (CORS).
    const svgMatch = p.match(/^\/api\/gallery\/(\d{1,15})\.svg$/);
    if (svgMatch && (req.method === "GET" || req.method === "HEAD")) {
      const rec = await getGallery(svgMatch[1]);
      if (!rec) return send(req, res, 404, { error: "Gubben finns inte." }, undefined, { "Access-Control-Allow-Origin": TRYCK_ORIGIN });
      const svg = figureSvg(rec);
      if (Buffer.byteLength(svg) > MAX_SVG) return send(req, res, 413, { error: "Gubben är för stor att trycka." }, undefined, { "Access-Control-Allow-Origin": TRYCK_ORIGIN });
      return send(req, res, 200, svg, "image/svg+xml; charset=utf-8", {
        "Access-Control-Allow-Origin": TRYCK_ORIGIN,
        "Cache-Control": "public, max-age=300",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'"
      });
    }
    // Catchphrase: PUT sparar (kräver nyckeln i X-Token), GET spelar upp
    const vm = p.match(/^\/api\/gallery\/(\d{1,15})\/voice$/);
    if (vm && req.method === "PUT") {
      const mime = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (!/^audio\/(webm|mp4|ogg|mpeg|aac|x-m4a|wav)$/.test(mime)) return send(req, res, 415, { error: "Ljudet har ett okänt format." });
      const token = String(req.headers["x-token"] || "");
      if (!token) return send(req, res, 400, { error: "Nyckel behövs." });
      const buf = await readBody(req, MAX_VOICE);
      if (buf.length < 200) return send(req, res, 400, { error: "Ljudet är tomt." });
      const ok = await setVoice(vm[1], token, mime, buf);
      return send(req, res, ok ? 200 : 403, ok ? { ok: true } : { error: "Bara den som sparade gubben kan lägga till en catchphrase." });
    }
    if (vm && (req.method === "GET" || req.method === "HEAD")) {
      const v = await getVoice(vm[1]);
      if (!v) return send(req, res, 404, { error: "Gubben har ingen catchphrase." });
      return send(req, res, 200, v.buf, v.mime, { "Cache-Control": "public, max-age=86400" });
    }
    const m = p.match(/^\/api\/gallery\/(\d{1,15})$/);
    if (m && req.method === "GET") {
      const rec = await getGallery(m[1]);
      return rec ? send(req, res, 200, { ...rec, id: m[1] }, undefined, { "Cache-Control": "no-store" }) : send(req, res, 404, { error: "Gubben finns inte." });
    }
    if (m && req.method === "PATCH") {
      const b = await readJson(req), name = str(b && b.name, 80);
      if (!name || !b.token) return send(req, res, 400, { error: "Namn och nyckel behövs." });
      const ok = await renameGallery(m[1], String(b.token), name);
      return send(req, res, ok ? 200 : 403, ok ? { ok: true } : { error: "Bara den som sparade gubben kan byta namn." });
    }
    if (await handleAdmin(req, res, p)) return;
    if (await handleGames(req, res, p, url)) return;
    if (p.startsWith("/api/")) return send(req, res, 404, { error: "Finns inte." });
    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res, p);
    send(req, res, 405, "Inte tillåtet", "text/plain; charset=utf-8");
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(req, res, e.status || 500, { error: "Något gick fel på servern." });
  }
});

initDb()
  .catch(e => { console.error("Kunde inte ansluta till databasen:", e.message); pool = null; })
  .finally(() => server.listen(PORT, () => console.log("Party lyssnar på port " + PORT)));
