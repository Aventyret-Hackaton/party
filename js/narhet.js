// Party i närheten: "Vill du komma på mitt party?"
//
// Tre sätt att hitta ett party i närheten:
// 1. Samma nätverk (wifi). Servern jämför. Kräver inget tillstånd och sker av sig själv på startskärmen.
// 2. Plats. Båda har delat sin plats och är högst 250 meter ifrån varandra. Se nara-server.js.
// 3. Ultraljud. Den som är i väntrummet trycker "Ropa ut inbjudan", och telefoner i samma rum
//    som letar hör koden med mikrofonen. Se js/ultraljud.js.
// Den som letar trycker "Hitta party i närheten" på startskärmen. Då frågar telefonen om plats och mikrofon.

/* ---------- Party i närheten ---------- */
const NEAR = { searching: false, until: 0, timer: null, shown: new Set(), open: null, status: "" };
const SEARCH_MS = 60 * 1000;

// Fråga servern om öppna omgångar i närheten. Platsen skickas bara om den redan är känd.
async function pollNearby() {
  if (currentScreen !== "s-home" || document.hidden || NEAR.open || !$("intro").hidden) return;
  await apiReady;
  if (!caps.api) return;
  try {
    const list = await api("POST", "/api/games/nearby", { loc: HERE.loc || null });
    const g = list.find(x => !NEAR.shown.has(x.id));
    if (g) showInvite(g.id, g.hostName, g.how);
  } catch (e) {}
}
// Var femte sekund på startskärmen, oftare medan man letar
function nearbyTick() {
  clearTimeout(NEAR.timer);
  if (NEAR.searching && Date.now() > NEAR.until) endSearch(t("nearbyDone"));
  pollNearby();
  NEAR.timer = setTimeout(nearbyTick, NEAR.searching ? 2500 : 5000);
}

/* ---------- Leta: plats och mikrofon ---------- */
async function startSearch() {
  if (NEAR.searching) { endSearch(""); return; }
  NEAR.searching = true; NEAR.until = Date.now() + SEARCH_MS;
  setNearStatus(t("nearbyListening"));
  renderNearby();
  locate();   // plats, om spelaren vill dela den
  const mic = await startListen(heardCode);
  if (!mic && NEAR.searching) setNearStatus(t("nearbyMicNo"));
  nearbyTick();
}
function endSearch(msg) {
  NEAR.searching = false;
  stopListen();
  setNearStatus(msg);
  renderNearby();
}
// Ultraljudet hörde en kod: finns omgången och har den plats kvar?
async function heardCode(code) {
  if (NEAR.open || NEAR.shown.has(code)) return;
  try {
    const g = (await api("GET", "/api/games")).find(x => x.id === code);
    if (g && g.max > g.joined) showInvite(g.id, g.hostName, "sound");
  } catch (e) {}
}
function setNearStatus(msg) { NEAR.status = msg; $("nearbyStatus").textContent = msg; }
function renderNearby() {
  $("nearbyBtn").textContent = NEAR.searching ? t("nearbyStop") : t("nearbyBtn");
  $("nearbyBtn").setAttribute("aria-pressed", NEAR.searching);
  $("nearbyStatus").textContent = NEAR.status;
}
$("nearbyBtn").onclick = startSearch;

/* ---------- Inbjudan ---------- */
function showInvite(id, hostName, how) {
  NEAR.shown.add(id);
  NEAR.open = { id, hostName, how };
  renderInvite();
  $("invite").hidden = false;
  $("inviteYes").focus();
  if (typeof fanfare === "function") fanfare();
  notify(t("inviteTitle"), t("inviteFrom", { name: hostName }), "invite-" + id);
}
function renderInvite() {
  const o = NEAR.open; if (!o) return;
  $("inviteFrom").textContent = t("inviteFrom", { name: o.hostName });
  $("inviteHow").textContent = t(o.how === "wifi" ? "inviteWifi" : o.how === "gps" ? "inviteGps" : "inviteSound");
}
function closeInvite() { NEAR.open = null; $("invite").hidden = true; }
$("inviteNo").onclick = closeInvite;
$("inviteYes").onclick = () => {
  const id = NEAR.open?.id; closeInvite();
  if (!id) return;
  endSearch("");
  // Till listan med öppna omgångar. Finns namnet redan går vi med direkt, annars får man skriva det först.
  S.mode = "online"; S.online = "join"; renderSetupChips(); show("s-setup");
  if (myName()) joinOnline(id, document.createElement("button"));
  else needName($("onlineErr"));
};
addEventListener("keydown", e => { if (e.key === "Escape" && NEAR.open) closeInvite(); });

/* ---------- Ropa ut från väntrummet ---------- */
function renderShout() {
  const g = ON?.game, can = g && g.status === "lobby" && g.players.length < g.max;
  $("shoutRow").hidden = !can;
  if (!can && ulShout) stopShout();
  $("shoutBtn").textContent = ulShout ? t("shoutStop") : t("shoutBtn");
  $("shoutBtn").setAttribute("aria-pressed", !!ulShout);
}
$("shoutBtn").onclick = () => {
  if (ulShout) stopShout();
  else if (ON?.game) startShout(ON.game.id, renderShout);
  renderShout();
};
// Sluta ropa och lyssna när man lämnar skärmen
setInterval(() => {
  if (ulShout && currentScreen !== "s-lobby") { stopShout(); renderShout(); }
  if (NEAR.searching && currentScreen !== "s-home") endSearch("");
}, 500);

nearbyTick();
