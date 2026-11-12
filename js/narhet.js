// Party i närheten: "Vill du komma på mitt party?"
//
// Tre sätt att hitta ett party i närheten:
// 1. Samma nätverk (wifi). Servern jämför. Kräver inget tillstånd och sker av sig själv på startskärmen.
// 2. Plats. Båda har delat sin plats och är högst 250 meter ifrån varandra. Se nara-server.js.
// 3. Ultraljud. Den som är i väntrummet trycker "Ropa ut inbjudan" och telefonen spelar koden.
//    Se js/ultraljud.js. Knappen för att lyssna ("Hitta party i närheten") är borttagen från
//    startskärmen, så just nu finns inget i spelet som lyssnar.
//
// Är man mitt i en omgång sparas inbjudan och visas först när omgången är klar: när gubben har
// visats på scenen och knapparna syns. Man blir aldrig avbruten mitt i ritandet.

/* ---------- Party i närheten ---------- */
const NEAR = { timer: null, shown: new Set(), open: null, pending: [] };

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
// Var femte sekund på startskärmen och efter en omgång, mer sällan mitt i en omgång
function nearbyTick() {
  clearTimeout(NEAR.timer);
  pollNearby();
  const busy = currentScreen !== "s-home" && currentScreen !== "s-stage";
  NEAR.timer = setTimeout(nearbyTick, busy ? 10000 : 5000);
}

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
// Sluta ropa när man lämnar väntrummet. Visa sparade inbjudningar när omgången är klar.
setInterval(() => {
  showPending();
  if (ulShout && currentScreen !== "s-lobby") { stopShout(); renderShout(); }
}, 500);

nearbyTick();
