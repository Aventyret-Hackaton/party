// Notiser i onlinespelet: säg till när omgången är full, när gubben är klar att kolla på
// och när det finns en ledig plats i en omgång. Bara om spelaren har tillåtit notiser.
// Fungerar medan Party är öppet (även i en annan flik), inte när webbläsaren är stängd.
// Safari på iPhone har inga notiser för vanliga webbsidor, där visas en förklaring i stället.

/* ---------- Notiser ---------- */
const NOTIFY_KEY = "party-notify";
const canNotify = () => "Notification" in window;
const notifyOn = () => canNotify() && Notification.permission === "granted" && lsGet(NOTIFY_KEY) === "1";

// Android kräver en service worker för att visa notiser (js/sw.js)
const swReg = "serviceWorker" in navigator && canNotify()
  ? navigator.serviceWorker.register("js/sw.js", { scope: "js/" }).catch(() => null)
  : Promise.resolve(null);

async function notify(title, body, tag) {
  // Ingen notis om spelaren redan tittar på spelet
  if (!notifyOn() || (document.visibilityState === "visible" && document.hasFocus())) return;
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

// Knappen "Tillåt notiser": under Online i Nytt spel, i väntrummet och på vänteskärmen
function renderNotify() {
  document.querySelectorAll(".notify-row").forEach(row => {
    const inSetup = !!row.closest("#s-setup");
    row.hidden = inSetup && !(S.mode === "online" && S.online);
    if (row.hidden) return;
    const b = row.querySelector(".notify-btn"), h = row.querySelector(".notify-hint");
    b.hidden = !canNotify();
    if (!canNotify()) { h.textContent = t("notifyNoSupport"); return; }
    const denied = Notification.permission === "denied", on = notifyOn();
    b.textContent = t(on ? "notifyBtnOn" : "notifyBtn"); b.disabled = denied;
    b.setAttribute("aria-pressed", on);
    h.textContent = t(denied ? "notifyBlocked" : "notifyHint");
  });
}
document.querySelectorAll(".notify-btn").forEach(b => b.onclick = async () => {
  if (notifyOn()) lsSet(NOTIFY_KEY, "");
  else {
    let p = Notification.permission;
    if (p === "default") { try { p = await Notification.requestPermission(); } catch (e) {} }
    if (p === "granted") lsSet(NOTIFY_KEY, "1");
  }
  renderNotify();
});

// Ny ledig plats i listan med öppna omgångar
let seatSeen = null;
function watchSeats(list) {
  const free = list.filter(g => g.max - g.joined > 0);
  if (seatSeen) free.filter(g => !seatSeen.has(g.id))
    .forEach(g => notify(t("notifySeatTitle"), t("notifySeatBody", { name: g.hostName }), "seat-" + g.id));
  seatSeen = new Set(free.map(g => g.id));
}
