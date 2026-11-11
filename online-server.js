// Onlinespel på servern: öppna omgångar, väntrum, turordning och avtäckning.
//
// Omgångarna ligger bara i serverns minne. Startar servern om (till exempel vid en deploy)
// avbryts pågående omgångar. Galleriet sparas separat och påverkas inte.
//
// Lösenord: om miljövariabeln ONLINE_PASSWORD finns måste varje anrop skicka samma
// lösenord i rubriken X-Party-Password. Lösenordet ska aldrig skrivas i koden, repot är publikt.
//
// API (alla svar är JSON):
//   GET  /api/games                  – öppna omgångar med lediga platser
//   POST /api/games                  – starta en omgång {name, city, players, dir, order, cat}
//   GET  /api/games/:id?v=           – läget i omgången (kräver spelarens nyckel)
//   POST /api/games/:id/join         – gå med {name, city}
//   POST /api/games/:id/leave        – lämna väntrummet
//   POST /api/games/:id/part         – skicka in sin del {i, s}
//   POST /api/games/:id/reveal       – värden vecklar ut
//   POST /api/games/:id/name         – sätt gubbens namn {name, what, galleryId}
//   POST /api/games/:id/push         – spara spelarens push-prenumeration, se push-server.js
// Spelarens id och nyckel skickas i rubrikerna X-Player och X-Key.

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const { savePush, pushAll } = require("./push-server.js");

const PASSWORD = process.env.ONLINE_PASSWORD || "";
const LOBBY_IDLE_MS = 25 * 1000;        // en spelare i väntrummet som inte hörs av på 25 s tas bort
const LOBBY_IDLE_PUSH_MS = 15 * 60 * 1000; // med push-notiser: 15 min, en iPhone i bakgrunden hörs inte av
const GAME_MAX_AGE_MS = 3 * 3600 * 1000; // omgångar städas bort efter tre timmar
const MAX_GAMES = 200;

/* ---------- Städer: samma lista och mittpunkt som i spelet (js/stader.js) ---------- */
const cityTools = (() => {
  const code = fs.readFileSync(path.join(__dirname, "js", "stader.js"), "utf8");
  return vm.runInNewContext(code + "\n;({ midpointCity, findCity })", { lang: "sv", Intl, Math });
})();

/* ---------- Ansikten för kategorin Äventyrare (assets/ansikten/ansikten.json) ---------- */
function randomFace() {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(__dirname, "assets", "ansikten", "ansikten.json"), "utf8"))
      .filter(f => f && f.namn && f.fil);
    if (!list.length) return null;
    const f = list[Math.floor(Math.random() * list.length)];
    return { name: f.namn, src: "assets/ansikten/" + f.fil };
  } catch (e) { return null; }
}

/* ---------- Omgångarna ---------- */
const games = new Map();
const hash = s => crypto.createHash("sha256").update(String(s)).digest("hex");
function genCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (;;) {
    let s = ""; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
    if (!games.has(s)) return s;
  }
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Vem ritar vilken del. Samma regler som i spelet i rummet (js/spel.js).
function makeAssign(nParts, ids, random) {
  const out = [];
  while (out.length < nParts) {
    const round = random ? shuffle([...ids]) : [...ids];
    if (random && out.length && round.length > 1 && round[0] === out[out.length - 1]) round.push(round.shift());
    out.push(...round);
  }
  return out.slice(0, nParts);
}
function touch(g) { g.v++; g.touched = Date.now(); }
function addPlayer(g, name, city) {
  const id = crypto.randomBytes(6).toString("hex"), key = crypto.randomBytes(18).toString("base64url");
  g.players.push({ id, name, city, keyHash: hash(key), seen: Date.now() });
  return { playerId: id, key };
}
function startIfFull(g) {
  if (g.status !== "lobby" || g.players.length < g.max) return;
  const ids = g.players.map(p => p.id);
  g.status = "drawing";
  g.current = 0;
  g.turns = makeAssign(g.n, ids, g.orderMode === "random");
  g.home = cityTools.midpointCity(g.players.map(p => p.city));
  g.face = g.cat === "staff" ? randomFace() : null;
}

// Ta bort spelare som har stängt sidan i väntrummet, och gamla omgångar
function sweep() {
  const now = Date.now();
  for (const [id, g] of games) {
    if (now - g.createdAt > GAME_MAX_AGE_MS) { games.delete(id); continue; }
    if (g.status !== "lobby") continue;
    const before = g.players.length;
    g.players = g.players.filter(p => now - p.seen < (p.push ? LOBBY_IDLE_PUSH_MS : LOBBY_IDLE_MS));
    if (!g.players.some(p => p.id === g.hostId)) { games.delete(id); continue; }  // värden har gått
    if (g.players.length !== before) touch(g);
  }
}
setInterval(sweep, 5000).unref();

/* ---------- Vad spelarna får se ---------- */
function publicGame(g) {
  const host = g.players.find(p => p.id === g.hostId);
  return { id: g.id, hostName: host ? host.name : "", hostCity: host ? host.city : "", names: g.players.map(p => p.name), max: g.max, joined: g.players.length, n: g.n, dir: g.dir, orderMode: g.orderMode, cat: g.cat };
}
function stateFor(g, me) {
  const out = {
    id: g.id, v: g.v, status: g.status, max: g.max, n: g.n, dir: g.dir, orderMode: g.orderMode, cat: g.cat,
    hostId: g.hostId, players: g.players.map(p => ({ id: p.id, name: p.name, city: p.city })),
    turns: g.turns, current: g.current, home: g.home, face: g.face,
    name: g.name, what: g.what, galleryId: g.galleryId, revealAt: g.revealAt
  };
  // Bara den som ska rita nästa del får se remsan från förra delen
  if (g.status === "drawing" && g.turns[g.current] === me.id && g.current > 0) out.prev = g.parts[g.current - 1] || [];
  if (g.status === "done" || g.status === "revealed") out.parts = g.parts;
  return out;
}

/* ---------- Anropen ---------- */
module.exports = function makeGamesApi({ send, readJson, str, cleanStroke }) {
  const deny = (req, res, status, error) => send(req, res, status, { error });
  const cleanCity = c => (typeof c === "string" && cityTools.findCity(c)) ? c : "Stockholm|SE";
  const cleanName = n => str(n, 30) || "Spelare";
  function auth(req, g) {
    const id = String(req.headers["x-player"] || ""), key = String(req.headers["x-key"] || "");
    const p = g.players.find(x => x.id === id);
    if (!p || p.keyHash !== hash(key)) return null;
    p.seen = Date.now();
    return p;
  }

  return async function handleGames(req, res, p, url) {
    if (!p.startsWith("/api/games")) return false;
    if (PASSWORD && req.headers["x-party-password"] !== PASSWORD) { deny(req, res, 401, "Fel lösenord."); return true; }

    // Lista öppna omgångar
    if (p === "/api/games" && req.method === "GET") {
      const list = [...games.values()].filter(g => g.status === "lobby" && g.players.length < g.max)
        .sort((a, b) => b.createdAt - a.createdAt).map(publicGame);
      send(req, res, 200, list, undefined, { "Cache-Control": "no-store" });
      return true;
    }
    // Starta en ny omgång
    if (p === "/api/games" && req.method === "POST") {
      if (games.size >= MAX_GAMES) sweep();
      if (games.size >= MAX_GAMES) { deny(req, res, 503, "För många omgångar just nu. Försök snart igen."); return true; }
      const b = await readJson(req) || {};
      const max = [3, 4, 5, 6].includes(+b.players) ? +b.players : 3;
      const g = {
        id: genCode(), v: 1, createdAt: Date.now(), touched: Date.now(), status: "lobby",
        max, n: max, dir: b.dir === "h" ? "h" : "v", orderMode: b.order === "random" ? "random" : "strict",
        cat: b.cat === "staff" ? "staff" : "free", players: [], turns: [], current: 0, parts: [],
        home: "", face: null, name: "", what: "", galleryId: "", revealAt: 0, hostId: ""
      };
      const me = addPlayer(g, cleanName(b.name), cleanCity(b.city));
      g.hostId = me.playerId;
      games.set(g.id, g);
      send(req, res, 201, { ...me, game: stateFor(g, { id: me.playerId }) });
      return true;
    }

    const m = p.match(/^\/api\/games\/([A-Z]{4})(?:\/(join|leave|part|reveal|name|push))?$/);
    if (!m) { deny(req, res, 404, "Finns inte."); return true; }
    const g = games.get(m[1]), action = m[2];
    if (!g) { deny(req, res, 404, "Omgången finns inte längre."); return true; }

    // Gå med
    if (action === "join" && req.method === "POST") {
      const b = await readJson(req) || {};
      if (g.status !== "lobby") { deny(req, res, 409, "started"); return true; }
      if (g.players.length >= g.max) { deny(req, res, 409, "full"); return true; }
      const me = addPlayer(g, cleanName(b.name), cleanCity(b.city));
      startIfFull(g);
      if (g.status === "drawing") pushAll(g, "full");
      touch(g);
      send(req, res, 200, { ...me, game: stateFor(g, { id: me.playerId }) });
      return true;
    }

    const me = auth(req, g);
    if (!me) { deny(req, res, 403, "Du är inte med i den här omgången."); return true; }

    if (!action && req.method === "GET") {
      if (url.searchParams.get("v") === String(g.v)) send(req, res, 200, { v: g.v, same: true }, undefined, { "Cache-Control": "no-store" });
      else send(req, res, 200, stateFor(g, me), undefined, { "Cache-Control": "no-store" });
      return true;
    }
    if (req.method !== "POST") { deny(req, res, 405, "Inte tillåtet."); return true; }

    if (action === "leave") {
      if (g.status === "lobby") {
        if (me.id === g.hostId) games.delete(g.id);
        else { g.players = g.players.filter(x => x.id !== me.id); touch(g); }
      }
      send(req, res, 200, { ok: true });
      return true;
    }
    if (action === "part") {
      const b = await readJson(req) || {};
      if (g.status !== "drawing" || +b.i !== g.current || g.turns[g.current] !== me.id) { deny(req, res, 409, "Det är inte din tur."); return true; }
      if (!Array.isArray(b.s) || b.s.length > 3000) { deny(req, res, 400, "Delen gick inte att läsa."); return true; }
      g.parts[g.current] = b.s.map(cleanStroke).filter(Boolean);
      g.current++;
      if (g.current >= g.n) { g.status = "done"; pushAll(g, "done"); }
      touch(g);
      send(req, res, 200, stateFor(g, me));
      return true;
    }
    if (action === "reveal") {
      if (me.id !== g.hostId) { deny(req, res, 403, "Bara värden kan veckla ut."); return true; }
      if (g.status === "done") { g.status = "revealed"; g.revealAt = Date.now(); touch(g); }
      send(req, res, 200, stateFor(g, me));
      return true;
    }
    if (action === "push") {
      const ok = savePush(me, await readJson(req), str);
      send(req, res, ok ? 200 : 400, ok ? { ok: true } : { error: "Prenumerationen gick inte att läsa." });
      return true;
    }
    if (action === "name") {
      const b = await readJson(req) || {};
      if (g.status !== "revealed" && g.status !== "done") { deny(req, res, 409, "Gubben är inte klar än."); return true; }
      if (b.name) g.name = str(b.name, 80);
      if (b.what) g.what = str(b.what, 60);
      if (b.galleryId && me.id === g.hostId) g.galleryId = str(b.galleryId, 40);
      touch(g);
      send(req, res, 200, stateFor(g, me));
      return true;
    }
    deny(req, res, 404, "Finns inte.");
    return true;
  };
};
