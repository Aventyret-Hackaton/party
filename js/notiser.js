// Notiser i onlinespelet: säg till när omgången är full och när gubben är klar att kolla på.
// Spelaren tillåter notiser en gång (under Online i Nytt spel). Därefter kommer de av sig själva
// till alla deltagare som har tillåtit dem.
//
// Två vägar:
// 1. Push från servern (push-server.js). Fungerar även när spelet ligger i bakgrunden eller
//    telefonen är låst. Det är den enda vägen på iPhone, och där bara om Party ligger på hemskärmen.
// 2. Vanlig notis från sidan, om push inte går. Fungerar bara medan Party är öppet.

/* ---------- Notiser ---------- */
const canNotify = () => "Notification" in window;
const notifyOn = () => canNotify() && Notification.permission === "granted";
const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Notis-hjälpen (js/sw.js). Gäller helst hela sidan; servern tillåter det med en rubrik.
const swReg = "serviceWorker" in navigator && canNotify()
  ? navigator.serviceWorker.register("js/sw.js", { scope: "/" })
      .catch(() => navigator.serviceWorker.register("js/sw.js", { scope: "js/" }))
      .catch(() => null)
  : Promise.resolve(null);
// Vänta tills notis-hjälpen är igång (högst fem sekunder)
async function activeReg() {
  const reg = await swReg;
  if (!reg || reg.active) return reg;
  const w = reg.installing || reg.waiting;
  if (w) await new Promise(ok => { w.addEventListener("statechange", () => w.state === "activated" && ok()); setTimeout(ok, 5000); });
  return reg.active ? reg : null;
}

// Vanlig notis från sidan. Hoppas över när servern redan skickar push i den här omgången.
async function notify(title, body, tag) {
  if (!notifyOn() || (typeof ON !== "undefined" && ON && ON.push)) return;
  const opts = { body, tag, icon: "assets/apple-touch-icon.png" };
  try {
    const reg = await activeReg();
    if (reg) { await reg.showNotification(title, opts); return; }
  } catch (e) {}
  try {
    const n = new Notification(title, opts);
    n.onclick = () => { focus(); n.close(); };
  } catch (e) {}
}

/* ---------- Push från servern ---------- */
const b64u = s => Uint8Array.from(atob((s + "=".repeat((4 - s.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
// Hämta eller skapa telefonens prenumeration. Byts nyckeln på servern (vid omstart) görs en ny.
async function pushSub() {
  await apiReady;
  if (!notifyOn() || !caps.pushKey) return null;
  const reg = await activeReg();
  if (!reg || !reg.pushManager) return null;
  try {
    const key = b64u(caps.pushKey);
    let sub = await reg.pushManager.getSubscription();
    const old = sub && sub.options && sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    if (sub && (!old || old.length !== key.length || old.some((v, i) => v !== key[i]))) { await sub.unsubscribe(); sub = null; }
    return sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  } catch (e) { console.warn("Push gick inte att slå på:", e); return null; }
}
// Tala om för servern vart notiserna i den här omgången ska skickas, på spelarens språk
async function registerPush(gameId) {
  const sub = await pushSub();
  if (!sub || !ON || ON.game?.id !== gameId) return;
  const texts = {
    full: { title: t("notifyFullTitle"), body: t("notifyFullBody") },
    done: { title: t("notifyDoneTitle"), body: t("notifyDoneBody") }
  };
  try {
    await api("POST", `/api/games/${gameId}/push`, { sub: sub.toJSON(), texts });
    if (ON && ON.game?.id === gameId) ON.push = true;
  } catch (e) { console.warn("Servern tog inte emot push:", e); }
}

/* ---------- Knappen "Tillåt notiser" under Online i Nytt spel ---------- */
// Syns bara tills spelaren har svarat.
function renderNotify() {
  const row = $("notifyRow"), b = $("notifyBtn"), h = $("notifyHint");
  const asked = canNotify() && Notification.permission !== "default";
  row.hidden = !(S.mode === "online" && S.online) || notifyOn();
  if (row.hidden) return;
  b.hidden = !canNotify() || asked;
  b.textContent = t("notifyBtn");
  h.textContent = t(!canNotify() ? (isIos ? "notifyIos" : "notifyNoSupport") : asked ? "notifyBlocked" : "notifyHint");
}
$("notifyBtn").onclick = async () => {
  try { await Notification.requestPermission(); } catch (e) {}
  renderNotify();
  pushSub();   // skapa prenumerationen direkt, medan spelaren just har tryckt
};
