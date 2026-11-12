// Party i närheten: "Vill du komma på mitt party?"
//
// Tre sätt att hitta ett party i närheten:
// 1. Samma nätverk (wifi). Servern jämför. Kräver inget tillstånd och sker av sig själv på startskärmen.
// 2. Plats. Båda har delat sin plats och är högst 250 meter ifrån varandra. Se nara-server.js.
// 3. Ultraljud. Den som är i väntrummet trycker "Ropa ut inbjudan", och telefoner i samma rum
//    som letar hör koden med mikrofonen. Se js/ultraljud.js.
// Den som letar trycker "Hitta party i närheten" på startskärmen. Då frågar telefonen om plats och mikrofon.
//
// Är man mitt i en omgång sparas inbjudan och visas först när omgången är klar: när gubben har
// visats på scenen och knapparna syns. Man blir aldrig avbruten mitt i ritandet.

/* ---------- Party i närheten ---------- */
const NEAR = { searching: false, until: 0, timer: null, shown: new Set(), open: null, status: "", pending: [] };
const SEARCH_MS = 60 * 1000;

// Får en inbjudan visas nu? På startskärmen, eller på scenen när den egna omgången är klar.
function canInvite() {
  if (NEAR.open || document.hidden || !$("intro").hidden) return false;
  if (currentScreen === "s-home") return true;
  return currentScreen === "s-stage" && !$("postShow").hidden && !$("stageActions").hidden;
}
// Fråga servern om öppna omgångar i närheten. Platsen skickas bara om den redan är känd.
// Är man mitt i en omgång sparas svaret tills omgången är klar.
async function pollNearby() {
  if (document.hidden || NEAR.open) return;
  await apiReady;
  if (!caps.api) return;
  try {
    const mine = [ON?.game?.id, ON?.game?.next].filter(Boolean);   // den egna omgången och nästa
    const list = await api("POST", "/api/games/nearby", { loc: HERE.loc || null });
    NEAR.pending = list.filter(x => !NEAR.shown.has(x.id) && !mine.includes(x.id));
  } catch (e) {}
  showPending();
}
function showPending() {
  if (!canInvite() || !NEAR.pending.length) return;
  const g = NEAR.pending.shift();
  showInvite(g.id, g.hostName, g.how);
}
// Var femte sekund på startskärmen och efter en omgång, oftare medan man letar, mer sällan mitt i en omgång
function nearbyTick() {
  clearTimeout(NEAR.timer);
  if (NEAR.searching && Date.now() > NEAR.until) endSearch(t("nearbyDone"));
  pollNearby();
  const busy = currentScreen !== "s-home" && currentScreen !== "s-stage";
  NEAR.timer = setTimeout(nearbyTick, NEAR.searching ? 2500 : busy ? 10000 : 5000);
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
// Sluta ropa och lyssna när man lämnar skärmen. Visa sparade inbjudningar när omgången är klar.
setInterval(() => {
  showPending();
  if (ulShout && currentScreen !== "s-lobby") { stopShout(); renderShout(); }
  if (NEAR.searching && currentScreen !== "s-home") endSearch("");
}, 500);

nearbyTick();
