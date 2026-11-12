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
//   POST /api/games/:id/reveal       – värden vecklar ut (bara värden ser gubben)
//   POST /api/games/:id/save         – värden sparar gubben {name, what, galleryId}, alla får se den
//   POST /api/games/:id/discard      – värden raderar gubben, de andra får veta det
//   POST /api/games/nearby           – öppna omgångar i närheten {loc: {lat, lon, acc}}, se nara-server.js
//   POST /api/games/:id/again        – spela igen: gå med i nästa omgång, eller starta den med samma inställningar {name, city}
//   POST /api/games/:id/resolve      – värden väljer hur omgången fortsätter när någon har lämnat {choice}
// Läget (status): lobby → drawing → done → revealed → saved eller deleted.
// Lämnar någon som har delar kvar att rita: drawing → paused. Värden väljer då
//   "share" (de som är kvar ritar de delarna) → drawing,
//   "wait"  (omgången syns i listan och en ny spelare tar över) → seeking → drawing,
//   "end"   (omgången avslutas för alla) → ended.
//   POST /api/games/:id/push         – spara spelarens push-prenumeration, se push-server.js
// Spelarens id och nyckel skickas i rubrikerna X-Player och X-Key.

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const { savePush, pushAll } = require("./push-server.js");
const { nearFrom, howNear } = require("./nara-server.js");

const PASSWORD = process.env.ONLINE_PASSWORD || "";
const LOBBY_IDLE_MS = 25 * 1000;        // en spelare i väntrummet som inte hörs av på 25 s tas bort
const LOBBY_IDLE_PUSH_MS = 15 * 60 * 1000; // med push-notiser: 15 min, en iPhone i bakgrunden hörs inte av
const MISSING_MS = 90 * 1000;           // den som har tur men inte hörs av på 90 s räknas som borta
const MISSING_PUSH_MS = 5 * 60 * 1000;  // med push-notiser: 5 min
const GAME_MAX_AGE_MS = 3 * 3600 * 1000; // omgångar städas bort efter tre timmar
const MAX_GAMES = 200;

/* ---------- Städer: samma lista och mittpunkt som i spelet (js/stader.js) ---------- */
const cityTools = (() => {
  const code = fs.readFileSync(path.join(__dirname, "js", "stader.js"), "utf8");
  return vm.runInNewContext(code + "\n;({ midpointCity, findCity })", { lang: "sv", Intl, Math });
})();

/* ---------- Delarna: samma lista som i spelet (js/kroppsdelar.js) ---------- */
// Servern bestämmer vilka delar en omgång har, så att alla spelare ser samma delnamn
// även om någon har en äldre version av spelet öppen.
const PARTSETS = (() => {
  const code = fs.readFileSync(path.join(__dirname, "js", "kroppsdelar.js"), "utf8");
  return vm.runInNewContext(code + "\n;PARTSETS", {});
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
  // left = har lämnat (eller ersatts), missing = har inte hörts av på länge men kan komma tillbaka
  g.players.push({ id, name, city, keyHash: hash(key), seen: Date.now(), left: false, missing: false });
  return { playerId: id, key };
}
// En ny omgång i väntrummet. b = {players, dir, order, cat}
function newGame(b) {
  const max = [3, 4, 5, 6].includes(+b.players) ? +b.players : 3;
  const g = {
    id: genCode(), v: 1, createdAt: Date.now(), touched: Date.now(), status: "lobby",
    max, n: max, dir: b.dir === "h" ? "h" : "v", orderMode: b.order === "random" ? "random" : "strict",
    cat: b.cat === "staff" ? "staff" : "free", players: [], keys: [], turns: [], current: 0, parts: [],
    home: "", face: null, name: "", what: "", galleryId: "", revealAt: 0, hostId: ""
  };
  g.keys = PARTSETS[g.dir][g.n];
  return g;
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

/* ---------- När någon lämnar en omgång som har börjat ---------- */
const MIDGAME = ["drawing", "paused", "seeking", "done", "revealed"];
const isGone = p => p.left || p.missing;
const active = g => g.players.filter(p => !isGone(p));
// De som är borta men har delar kvar att rita
function blocking(g) {
  const future = new Set(g.turns.slice(g.current));
  return g.players.filter(p => isGone(p) && future.has(p.id));
}
// Har värden gått lämnar vi över till den som senast hördes av
function fixHost(g, force) {
  const host = g.players.find(p => p.id === g.hostId);
  if (host && !isGone(host) && !force) return true;
  const next = active(g).filter(p => p.id !== g.hostId).sort((a, b) => b.seen - a.seen)[0];
  if (!next) return false;
  g.hostId = next.id;
  if (g.status === "revealed") g.status = "done";   // den nya värden vecklar ut själv
  return true;
}
// Räkna om läget efter att någon har lämnat eller kommit tillbaka
function settle(g) {
  if (!active(g).length) { games.delete(g.id); return; }
  if (!fixHost(g)) { games.delete(g.id); return; }
  const stuck = blocking(g).length > 0;
  if (g.status === "drawing" && stuck) g.status = "paused";
  else if ((g.status === "paused" || g.status === "seeking") && !stuck) g.status = "drawing";
}
// "Rita klart själva": delarna som de borta skulle rita fördelas på de som är kvar
function shareParts(g) {
  const gone = new Set(blocking(g).map(p => p.id)), left = active(g).map(p => p.id);
  const count = id => g.turns.slice(g.current).filter(x => x === id).length;
  for (let i = g.current; i < g.n; i++) {
    if (!gone.has(g.turns[i])) continue;
    let pick = left.filter(id => id !== g.turns[i - 1]);
    if (!pick.length) pick = left;
    pick.sort((a, b) => count(a) - count(b));
    g.turns[i] = pick[0];
  }
  gone.forEach(id => { const p = g.players.find(x => x.id === id); if (p) p.left = true; });
}
// En ny spelare tar över delarna efter den första som är borta
function takeOver(g, newId) {
  const old = blocking(g)[0]; if (!old) return;
  for (let i = g.current; i < g.n; i++) if (g.turns[i] === old.id) g.turns[i] = newId;
  old.left = true;
}

// Ta bort spelare som har stängt sidan i väntrummet, märk de som försvunnit mitt i, och städa gamla omgångar
function sweep() {
  const now = Date.now();
  for (const [id, g] of games) {
    if (now - g.createdAt > GAME_MAX_AGE_MS) { games.delete(id); continue; }
    if (MIDGAME.includes(g.status)) {
      const before = g.status + g.hostId + blocking(g).length;
      const quiet = p => now - p.seen > (p.push ? MISSING_PUSH_MS : MISSING_MS);
      // Den som har tur och inte hörs av räknas som borta
      const cur = g.status === "drawing" && g.players.find(p => p.id === g.turns[g.current]);
      if (cur && !isGone(cur) && quiet(cur)) cur.missing = true;
      // Värden som inte hörs av när den ska bestämma något lämnar över till någon annan
      const host = g.players.find(p => p.id === g.hostId);
      if (host && quiet(host) && ["paused", "seeking", "done", "revealed"].includes(g.status)) fixHost(g, true);
      settle(g);
      if (games.has(id) && before !== g.status + g.hostId + blocking(g).length) touch(g);
      continue;
    }
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
  const seeking = g.status === "seeking", here = active(g);
  return { id: g.id, hostName: host ? host.name : "", hostCity: host ? host.city : "", names: here.map(p => p.name), max: g.max,
    joined: seeking ? g.max - blocking(g).length : here.length, seeking, n: g.n, dir: g.dir, orderMode: g.orderMode, cat: g.cat };
}
function stateFor(g, me) {
  const out = {
    id: g.id, v: g.v, status: g.status, max: g.max, n: g.n, dir: g.dir, orderMode: g.orderMode, cat: g.cat,
    hostId: g.hostId, players: g.players.map(p => ({ id: p.id, name: p.name, city: p.city, left: p.left, missing: p.missing })),
    gone: blocking(g).map(p => p.id),
    keys: g.keys, next: g.next || "",
    turns: g.turns, current: g.current, home: g.home, face: g.face,
    name: g.name, what: g.what, galleryId: g.galleryId, revealAt: g.revealAt
  };
  // Bara den som ska rita nästa del får se remsan från förra delen
  if (["drawing", "paused", "seeking"].includes(g.status) && g.turns[g.current] === me.id && g.current > 0) out.prev = g.parts[g.current - 1] || [];
  // Medan värden bestämmer om gubben ska sparas ser bara värden den. Raderas den får ingen annan se den.
  if (g.status === "saved" || ((g.status === "done" || g.status === "revealed") && me.id === g.hostId)) out.parts = g.parts;
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
    // Den som bara var borta en stund kommer tillbaka, om ingen har tagit över
    if (p.missing && !p.left) { p.missing = false; settle(g); touch(g); }
    return p;
  }

  return async function handleGames(req, res, p, url) {
    if (!p.startsWith("/api/games")) return false;
    if (PASSWORD && req.headers["x-party-password"] !== PASSWORD) { deny(req, res, 401, "Fel lösenord."); return true; }

    // Lista öppna omgångar
    if (p === "/api/games" && req.method === "GET") {
      const list = [...games.values()].filter(g => (g.status === "lobby" && g.players.length < g.max) || g.status === "seeking")
        .sort((a, b) => b.createdAt - a.createdAt).map(publicGame);
      send(req, res, 200, list, undefined, { "Cache-Control": "no-store" });
      return true;
    }
    // Party i närheten: öppna omgångar på samma nätverk eller inom 250 meter
    if (p === "/api/games/nearby" && req.method === "POST") {
      const b = await readJson(req) || {};
      const me = nearFrom(req, b);
      const list = [...games.values()].filter(g => g.status === "lobby" && g.players.length < g.max)
        .map(g => ({ g, how: howNear(g, me) })).filter(x => x.how)
        .sort((a, b) => b.g.createdAt - a.g.createdAt).slice(0, 5)
        .map(({ g, how }) => ({ id: g.id, hostName: publicGame(g).hostName, how }));
      send(req, res, 200, list, undefined, { "Cache-Control": "no-store" });
      return true;
    }
    // Starta en ny omgång
    if (p === "/api/games" && req.method === "POST") {
      if (games.size >= MAX_GAMES) sweep();
      if (games.size >= MAX_GAMES) { deny(req, res, 503, "För många omgångar just nu. Försök snart igen."); return true; }
      const b = await readJson(req) || {};
      const g = newGame(b);
      g.near = nearFrom(req, b);   // för Party i närheten
      const me = addPlayer(g, cleanName(b.name), cleanCity(b.city));
      g.hostId = me.playerId;
      games.set(g.id, g);
      send(req, res, 201, { ...me, game: stateFor(g, { id: me.playerId }) });
      return true;
    }

    const m = p.match(/^\/api\/games\/([A-Z]{4})(?:\/(join|leave|part|reveal|save|discard|push|resolve|again))?$/);
    if (!m) { deny(req, res, 404, "Finns inte."); return true; }
    const g = games.get(m[1]), action = m[2];
    if (!g) { deny(req, res, 404, "Omgången finns inte längre."); return true; }

    // Gå med
    if (action === "join" && req.method === "POST") {
      const b = await readJson(req) || {};
      // En omgång som söker en ny spelare: den nya tar över delarna efter den som lämnade
      if (g.status === "seeking") {
        const me = addPlayer(g, cleanName(b.name), cleanCity(b.city));
        takeOver(g, me.playerId);
        settle(g);
        touch(g);
        send(req, res, 200, { ...me, game: stateFor(g, { id: me.playerId }) });
        return true;
      }
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
      } else if (MIDGAME.includes(g.status)) {
        me.left = true;
        settle(g);
        touch(g);
      }
      send(req, res, 200, { ok: true });
      return true;
    }
    if (action === "part") {
      const b = await readJson(req) || {};
      // Den som redan ritar får rita klart sin del även om någon annan har lämnat under tiden
      if (!["drawing", "paused", "seeking"].includes(g.status) || +b.i !== g.current || g.turns[g.current] !== me.id) { deny(req, res, 409, "Det är inte din tur."); return true; }
      if (!Array.isArray(b.s) || b.s.length > 3000) { deny(req, res, 400, "Delen gick inte att läsa."); return true; }
      g.parts[g.current] = b.s.map(cleanStroke).filter(Boolean);
      g.current++;
      if (g.current >= g.n) g.status = "done";
      else settle(g);   // nästa del kan vara någons som har lämnat   // notisen "gubben är klar" skickas först när värden har sparat den
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
    // Spela igen: den första som trycker startar en ny omgång med samma inställningar, de andra går med i den
    if (action === "again") {
      const b = await readJson(req) || {};
      if (!["saved", "deleted", "ended"].includes(g.status)) { deny(req, res, 409, "Omgången är inte klar."); return true; }
      let n = g.next && games.get(g.next);
      if (n && n.status === "lobby" && n.players.length < n.max) {
        const joined = addPlayer(n, cleanName(b.name), cleanCity(b.city));
        startIfFull(n);
        if (n.status === "drawing") pushAll(n, "full");
        touch(n);
        send(req, res, 200, { ...joined, game: stateFor(n, { id: joined.playerId }) });
        return true;
      }
      if (games.size >= MAX_GAMES) sweep();
      if (games.size >= MAX_GAMES) { deny(req, res, 503, "För många omgångar just nu. Försök snart igen."); return true; }
      n = newGame({ players: g.max, dir: g.dir, order: g.orderMode, cat: g.cat });
      n.near = nearFrom(req, b);
      const host = addPlayer(n, cleanName(b.name), cleanCity(b.city));
      n.hostId = host.playerId;
      games.set(n.id, n);
      g.next = n.id;
      touch(g);
      send(req, res, 201, { ...host, game: stateFor(n, { id: host.playerId }) });
      return true;
    }
    if (action === "resolve") {
      const b = await readJson(req) || {};
      if (me.id !== g.hostId) { deny(req, res, 403, "Bara värden bestämmer."); return true; }
      if (g.status !== "paused" && g.status !== "seeking") { deny(req, res, 409, "Ingen har lämnat."); return true; }
      if (b.choice === "share") { shareParts(g); settle(g); }
      else if (b.choice === "wait") g.status = "seeking";
      else if (b.choice === "end") { g.status = "ended"; g.parts = []; }
      else { deny(req, res, 400, "Okänt val."); return true; }
      touch(g);
      send(req, res, 200, stateFor(g, me));
      return true;
    }
    if (action === "save" || action === "discard") {
      const b = await readJson(req) || {};
      if (me.id !== g.hostId) { deny(req, res, 403, "Bara värden bestämmer."); return true; }
      if (g.status !== "revealed" && g.status !== "done") { deny(req, res, 409, "Gubben är inte klar än."); return true; }
      if (action === "save") {
        g.status = "saved";
        g.name = str(b.name, 80);
        g.what = str(b.what, 60);
        g.galleryId = str(b.galleryId, 40);
        pushAll(g, "done");
      } else {
        g.status = "deleted";
        g.parts = [];
      }
      touch(g);
      send(req, res, 200, stateFor(g, me));
      return true;
    }
    deny(req, res, 404, "Finns inte.");
    return true;
  };
};
