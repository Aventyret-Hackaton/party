// Notiser i onlinespelet: säg till när det finns en ledig plats i en omgång
// och när gubben är klar att kolla på. Bara om spelaren har slagit på dem.
// Fungerar medan Party är öppet (även i en annan flik), inte när webbläsaren är stängd.

/* ---------- Notiser ---------- */
const NOTIFY_KEY = "party-notify";
const canNotify = () => "Notification" in window;
const notifyOn = () => canNotify() && Notification.permission === "granted" && lsGet(NOTIFY_KEY) === "1";

function notify(title, body, tag) {
  // Ingen notis om spelaren redan tittar på spelet
  if (!notifyOn() || (document.visibilityState === "visible" && document.hasFocus())) return;
  try {
    const n = new Notification(title, { body, tag, icon: "assets/apple-touch-icon.png" });
    n.onclick = () => { focus(); n.close(); };
  } catch (e) {}
}

// Knappen under Online i Nytt spel
function renderNotify() {
  const row = $("notifyRow"), b = $("notifyBtn"), h = $("notifyHint");
  row.hidden = !(S.mode === "online" && S.online && canNotify());
  if (row.hidden) return;
  const denied = Notification.permission === "denied";
  b.textContent = t("notifyBtn"); b.disabled = denied;
  b.setAttribute("aria-pressed", notifyOn());
  h.textContent = t(denied ? "notifyBlocked" : "notifyHint");
}
$("notifyBtn").onclick = async () => {
  if (notifyOn()) lsSet(NOTIFY_KEY, "");
  else {
    let p = Notification.permission;
    if (p === "default") { try { p = await Notification.requestPermission(); } catch (e) {} }
    if (p === "granted") lsSet(NOTIFY_KEY, "1");
  }
  renderNotify();
};

// Ny ledig plats i listan med öppna omgångar
let seatSeen = null;
function watchSeats(list) {
  const free = list.filter(g => g.max - g.joined > 0);
  if (seatSeen) free.filter(g => !seatSeen.has(g.id))
    .forEach(g => notify(t("notifySeatTitle"), t("notifySeatBody", { name: g.hostName }), "seat-" + g.id));
  seatSeen = new Set(free.map(g => g.id));
}
