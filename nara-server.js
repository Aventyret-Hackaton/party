// Party i närheten: vilka öppna omgångar finns nära den som frågar?
//
// Nära betyder:
// - samma nätverk (samma publika IP-adress, till exempel samma wifi), eller
// - båda har delat sin plats och är högst 250 meter från varandra.
//
// Integritet: IP-adressen sparas aldrig i klartext, bara som en hash med ett salt som byts
// vid varje omstart. Platsen sparas bara i minnet medan omgången är öppen, och lämnas aldrig ut.
// Den som frågar får bara veta omgångens kod, värdens namn och om den är nära via wifi eller plats.
//
// Obs: på mobilnät delar ofta många telefoner samma IP-adress. Då kan någon längre bort räknas
// som "samma nätverk". Det är ofarligt, eftersom listan med öppna omgångar ändå är öppen för alla.

const crypto = require("crypto");

const SALT = crypto.randomBytes(16).toString("hex");
const NEAR_M = 250;   // så nära två platser måste vara

// Heroku lägger till den riktiga adressen sist i X-Forwarded-For. Det som står före kan klienten ha hittat på.
function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",").map(s => s.trim()).filter(Boolean);
  return fwd.length ? fwd[fwd.length - 1] : String(req.socket.remoteAddress || "");
}
const netOf = req => crypto.createHash("sha256").update(SALT + clientIp(req)).digest("hex").slice(0, 32);

// { lat, lon, acc } från spelet, eller null
function cleanLoc(l) {
  if (!l || typeof l !== "object") return null;
  const lat = Number(l.lat), lon = Number(l.lon), acc = Number(l.acc);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, acc: isFinite(acc) && acc >= 0 ? Math.min(acc, 100000) : 1000 };
}
function distM(a, b) {
  const rad = Math.PI / 180, dLa = (b.lat - a.lat) * rad, dLo = (b.lon - a.lon) * rad;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// Det som sparas på omgången när värden startar den
const nearFrom = (req, body) => ({ net: netOf(req), loc: cleanLoc(body && body.loc) });

// Är omgången g nära den som frågar? Svarar "wifi", "gps" eller "".
function howNear(g, me) {
  if (!g.near) return "";
  if (g.near.net === me.net) return "wifi";
  if (g.near.loc && me.loc && distM(g.near.loc, me.loc) <= NEAR_M) return "gps";
  return "";
}

module.exports = { nearFrom, howNear };
