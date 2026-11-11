// Push-notiser från servern: säg till när omgången är full och när gubben är klar,
// även när spelet ligger i bakgrunden eller telefonen är låst. Krävs för iPhone.
//
// Nycklar (VAPID): sätt miljövariablerna VAPID_PUBLIC_KEY och VAPID_PRIVATE_KEY på Heroku
// om de ska vara desamma efter en omstart. Saknas de skapar servern ett nytt nyckelpar vid
// varje start. Det räcker, eftersom omgångarna ändå bara finns i minnet och försvinner vid
// en omstart. Den privata nyckeln ska aldrig skrivas i koden, repot är publikt.
//
// Biblioteket web-push sköter krypteringen. Saknas det stängs push av, och spelet
// använder bara de vanliga notiserna medan sidan är öppen.

let webpush = null;
try { webpush = require("web-push"); } catch (e) { console.warn("web-push saknas, push-notiser är avstängda."); }

let publicKey = "";
if (webpush) {
  let keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  if (!keys.publicKey || !keys.privateKey) keys = webpush.generateVAPIDKeys();
  const subject = process.env.VAPID_SUBJECT || "https://github.com/Aventyret-Hackaton/party";
  try { webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey); publicKey = keys.publicKey; }
  catch (e) { console.warn("Push-nycklarna fungerar inte, push är avstängt:", e.message); }
}

// Servern skickar bara till kända push-tjänster (Google, Apple, Mozilla, Microsoft),
// så att ingen kan få servern att anropa vilken adress som helst.
const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;
const KINDS = ["full", "done"];

// Spara en spelares prenumeration. body = { sub: {endpoint, keys}, texts: {full:{title,body}, done:{title,body}} }
// Texterna kommer från spelet, så att notisen hamnar på spelarens eget språk.
function savePush(player, body, str) {
  if (!publicKey) return false;
  const sub = body && body.sub, texts = body && body.texts;
  let host = "";
  try { const u = new URL(String(sub && sub.endpoint)); if (u.protocol === "https:") host = u.hostname; } catch (e) {}
  if (!host || !PUSH_HOSTS.test(host) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return false;
  const clean = {};
  for (const k of KINDS) clean[k] = { title: str(texts && texts[k] && texts[k].title, 80) || "Party", body: str(texts && texts[k] && texts[k].body, 160) };
  player.push = { sub: { endpoint: String(sub.endpoint), keys: { p256dh: str(sub.keys.p256dh, 200), auth: str(sub.keys.auth, 100) } }, texts: clean };
  return true;
}

// Skicka en notis till alla i omgången som har en prenumeration. kind = "full" eller "done".
function pushAll(game, kind) {
  if (!publicKey) return;
  for (const p of game.players) {
    if (!p.push) continue;
    const t = p.push.texts[kind];
    const payload = JSON.stringify({ title: t.title, body: t.body, tag: kind + "-" + game.id });
    webpush.sendNotification(p.push.sub, payload, { TTL: 600, urgency: "high" })
      .catch(e => {
        // 404/410: prenumerationen finns inte längre
        if (e && (e.statusCode === 404 || e.statusCode === 410)) p.push = null;
        else console.warn("Push misslyckades:", e && (e.statusCode || e.message));
      });
  }
}

module.exports = { pushKey: () => publicKey, savePush, pushAll };
