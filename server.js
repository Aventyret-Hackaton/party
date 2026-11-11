// Servern på Heroku: visar spelet och sparar det gemensamma galleriet.
//
// Galleriet sparas i Heroku Postgres (miljövariabeln DATABASE_URL, som Heroku sätter
// när databasen läggs till). Saknas databasen sparas bilderna bara i minnet och
// försvinner när servern startar om, till exempel vid varje deploy.
//
// API:
//   GET   /api/health          – finns servern, och var sparas bilderna?
//   GET   /api/gallery         – de senaste gubbarna
//   POST  /api/gallery         – spara en ny gubbe, svarar med id och en nyckel
//   PATCH /api/gallery/:id     – byt namn, kräver nyckeln från POST

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const MAX_BODY = 400 * 1024;      // största tillåtna gubbe i byte
const LIST_LIMIT = 150;           // hur många gubbar galleriet visar
const POSTS_PER_HOUR = 40;        // per IP-adress, mot spam

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
  console.log("Galleriet sparas i Postgres.");
}

const hash = s => crypto.createHash("sha256").update(String(s)).digest("hex");

async function listGallery() {
  if (pool) {
    const r = await pool.query("SELECT id, created_at, data FROM gallery ORDER BY id DESC LIMIT $1", [LIST_LIMIT]);
    return r.rows.map(row => ({ ...row.data, id: String(row.id), createdAt: row.created_at.toISOString() }));
  }
  return memory.slice(0, LIST_LIMIT).map(m => ({ ...m.data, id: m.id, createdAt: m.createdAt }));
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
function cleanRecord(b) {
  if (!b || typeof b !== "object") return null;
  if (b.dir !== "v" && b.dir !== "h") return null;
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
function send(req, res, status, body, type = "application/json; charset=utf-8", extra = {}) {
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  const headers = { "Content-Type": type, "X-Content-Type-Options": "nosniff", ...extra };
  if (buf.length > 1024 && /\bgzip\b/.test(req.headers["accept-encoding"] || "") && /json|text|javascript|svg/.test(type)) {
    buf = zlib.gzipSync(buf); headers["Content-Encoding"] = "gzip"; headers["Vary"] = "Accept-Encoding";
  }
  headers["Content-Length"] = buf.length;
  res.writeHead(status, headers);
  res.end(req.method === "HEAD" ? undefined : buf);
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

/* ---------- Routning ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  try {
    if (p === "/api/health" && req.method === "GET") {
      return send(req, res, 200, { ok: true, storage: pool ? "postgres" : "memory" });
    }
    if (p === "/api/gallery" && req.method === "GET") {
      return send(req, res, 200, await listGallery(), undefined, { "Cache-Control": "no-store" });
    }
    if (p === "/api/gallery" && req.method === "POST") {
      const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      if (!allowPost(ip)) return send(req, res, 429, { error: "För många gubbar på kort tid. Vänta en stund." });
      const rec = cleanRecord(await readJson(req));
      if (!rec) return send(req, res, 400, { error: "Gubben gick inte att läsa." });
      return send(req, res, 201, await addGallery(rec));
    }
    const m = p.match(/^\/api\/gallery\/(\d+)$/);
    if (m && req.method === "PATCH") {
      const b = await readJson(req), name = str(b && b.name, 80);
      if (!name || !b.token) return send(req, res, 400, { error: "Namn och nyckel behövs." });
      const ok = await renameGallery(m[1], String(b.token), name);
      return send(req, res, ok ? 200 : 403, ok ? { ok: true } : { error: "Bara den som sparade gubben kan byta namn." });
    }
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
