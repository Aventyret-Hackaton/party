// Adminläget: radera eller byta namn på gubbar och gruppbilder i galleriet.
//
// Det finns ett enda adminkonto. Användarnamnet och en hash av lösenordet ligger i
// miljövariablerna (Heroku config vars), aldrig i koden, eftersom repot är publikt:
//   ADMIN_USER  – användarnamnet
//   ADMIN_HASH  – lösenordet hashat med scrypt, i formen scrypt$N$r$p$salt$hash (base64)
// Ett nytt lösenord och dess hash tas fram med: node tools/admin-hash.js
// Saknas variablerna går det inte att logga in alls.
//
// API:
//   POST   /api/admin/login         – {user, pass} → {token}. Högst 8 försök per kvart och IP-adress.
//   POST   /api/admin/logout        – glöm inloggningen
//   GET    /api/admin/check         – är inloggningen giltig?
//   PATCH  /api/admin/gallery/:id   – byt namn {name}
//   DELETE /api/admin/gallery/:id   – radera för alltid, med ljud och allt
// Inloggningen skickas som "Authorization: Bearer <token>" och gäller i åtta timmar.
// Den finns bara i serverns minne, så efter en omstart får man logga in igen.

const crypto = require("crypto");

const SESSION_MS = 8 * 3600 * 1000;
const sessions = new Map();          // token-hash → när den slutar gälla
const attempts = new Map();          // IP → tidpunkter för inloggningsförsök

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",").map(s => s.trim()).filter(Boolean);
  return fwd.length ? fwd[fwd.length - 1] : String(req.socket.remoteAddress || "");
}
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
// Jämför i konstant tid, så att svarstiden inte avslöjar något
function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function checkPassword(pass, stored) {
  return new Promise(resolve => {
    const m = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/.exec(stored || "");
    if (!m) return resolve(false);
    const [, N, r, p, salt, hash] = m, want = Buffer.from(hash, "base64");
    crypto.scrypt(String(pass), Buffer.from(salt, "base64"), want.length, { N: +N, r: +r, p: +p, maxmem: 256 * 1024 * 1024 }, (err, got) => {
      resolve(!err && got.length === want.length && crypto.timingSafeEqual(got, want));
    });
  });
}
function isAdmin(req) {
  const m = /^Bearer ([A-Za-z0-9_-]{20,})$/.exec(String(req.headers.authorization || ""));
  if (!m) return false;
  const key = sha(m[1]), until = sessions.get(key);
  if (!until || until < Date.now()) { sessions.delete(key); return false; }
  return true;
}

module.exports = function makeAdminApi({ send, readJson, str, deleteGallery, adminRename }) {
  return async function handleAdmin(req, res, p) {
    if (!p.startsWith("/api/admin/")) return false;
    const noStore = { "Cache-Control": "no-store" };
    if (p === "/api/admin/login" && req.method === "POST") {
      const ip = clientIp(req), now = Date.now();
      const list = (attempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
      if (list.length >= 8) { attempts.set(ip, list); send(req, res, 429, { error: "För många försök. Vänta en kvart." }, undefined, noStore); return true; }
      list.push(now); attempts.set(ip, list);
      const b = await readJson(req) || {};
      const user = process.env.ADMIN_USER || "", stored = process.env.ADMIN_HASH || "";
      // Lösenordet kontrolleras alltid, även när användarnamnet är fel, så att svaret tar lika lång tid
      const okPass = await checkPassword(str(b.pass, 200), stored);
      if (!user || !stored || !same(str(b.user, 80), user) || !okPass) {
        send(req, res, 401, { error: "Fel användarnamn eller lösenord." }, undefined, noStore);
        return true;
      }
      attempts.delete(ip);
      const token = crypto.randomBytes(32).toString("base64url");
      sessions.set(sha(token), now + SESSION_MS);
      send(req, res, 200, { token }, undefined, noStore);
      return true;
    }
    if (p === "/api/admin/logout" && req.method === "POST") {
      const m = /^Bearer (.+)$/.exec(String(req.headers.authorization || ""));
      if (m) sessions.delete(sha(m[1]));
      send(req, res, 200, { ok: true }, undefined, noStore);
      return true;
    }
    if (!isAdmin(req)) { send(req, res, 401, { error: "Logga in som admin." }, undefined, noStore); return true; }
    if (p === "/api/admin/check" && req.method === "GET") { send(req, res, 200, { ok: true }, undefined, noStore); return true; }
    const m = p.match(/^\/api\/admin\/gallery\/(\d{1,15})$/);
    if (m && req.method === "DELETE") {
      const ok = await deleteGallery(m[1]);
      send(req, res, ok ? 200 : 404, ok ? { ok: true } : { error: "Finns inte." }, undefined, noStore);
      return true;
    }
    if (m && req.method === "PATCH") {
      const b = await readJson(req) || {}, name = str(b.name, 80);
      if (!name) { send(req, res, 400, { error: "Namn behövs." }, undefined, noStore); return true; }
      const ok = await adminRename(m[1], name);
      send(req, res, ok ? 200 : 404, ok ? { ok: true } : { error: "Finns inte." }, undefined, noStore);
      return true;
    }
    send(req, res, 404, { error: "Finns inte." }, undefined, noStore);
    return true;
  };
};
