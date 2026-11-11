// Notiser i onlinespelet: säg till när omgången är full och när gubben är klar att kolla på.
// Spelaren tillåter notiser en gång (under Online i Nytt spel). Därefter kommer de av sig själva
// till alla deltagare som har tillåtit dem.
// Fungerar medan Party är öppet (även i en annan flik), inte när webbläsaren är stängd.
// Safari på iPhone har inga notiser för vanliga webbsidor, där visas en förklaring i stället.

/* ---------- Notiser ---------- */
const canNotify = () => "Notification" in window;
const notifyOn = () => canNotify() && Notification.permission === "granted";

// Android kräver en service worker för att visa notiser (js/sw.js)
const swReg = "serviceWorker" in navigator && canNotify()
  ? navigator.serviceWorker.register("js/sw.js", { scope: "js/" }).catch(() => null)
  : Promise.resolve(null);

async function notify(title, body, tag) {
  if (!notifyOn()) return;
  const opts = { body, tag, icon: "assets/apple-touch-icon.png" };
  try {
    const reg = await swReg;
    if (reg) { await reg.showNotification(title, opts); return; }
  } catch (e) {}
  try {
    const n = new Notification(title, opts);
    n.onclick = () => { focus(); n.close(); };
  } catch (e) {}
}

// "Tillåt notiser" under Online i Nytt spel. Syns bara tills spelaren har svarat.
function renderNotify() {
  const row = $("notifyRow"), b = $("notifyBtn"), h = $("notifyHint");
  const asked = canNotify() && Notification.permission !== "default";
  row.hidden = !(S.mode === "online" && S.online) || notifyOn();
  if (row.hidden) return;
  b.hidden = !canNotify() || asked;
  b.textContent = t("notifyBtn");
  h.textContent = t(!canNotify() ? "notifyNoSupport" : asked ? "notifyBlocked" : "notifyHint");
}
$("notifyBtn").onclick = async () => {
  try { await Notification.requestPermission(); } catch (e) {}
  renderNotify();
};
