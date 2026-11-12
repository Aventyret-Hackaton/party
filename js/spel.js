// Skärmbyten, inställningar och spel i rummet.

/* ---------- Skärmhantering ---------- */
let currentScreen = "s-home";

/* ---------- Bakåt: webbläsarens bakåtknapp och Androids svep från kanten ---------- */
// Menyskärmarna läggs i webbläsarens historik, så att bakåt går tillbaka till startskärmen i stället
// för att lämna spelet. Mitt i ett spel gör bakåt ingenting, så att ingen råkar svepa sig ut.
// Historiken blir aldrig djupare än: start → meny (→ en gubbe från galleriet).
const NAV_MENU = ["s-setup", "s-names", "s-gallery", "s-faces"];
const NAV_GAME = ["s-lobby", "s-handoff", "s-draw", "s-face", "s-wait", "s-pause", "s-group"];
let navDepth = 0, navSkip = false;
function navPush(state) { history.pushState(state, ""); navDepth++; }
function navTrack(id) {
  const st = history.state;
  if (id === "s-home") {
    if (navDepth) { navSkip = true; history.go(-navDepth); navDepth = 0; }
  } else if (NAV_MENU.includes(id)) {
    if (st?.party === "screen" && st.id === "s-setup" && id === "s-names") navPush({ party: "screen", id });   // namnen → tillbaka till Nytt spel
    else if (st?.party === "screen" || st?.party === "game") history.replaceState({ party: "screen", id }, "");
    else if (!navDepth) navPush({ party: "screen", id });
  } else if (NAV_GAME.includes(id) && st?.party !== "game") {
    if (navDepth) history.replaceState({ party: "game" }, ""); else navPush({ party: "game" });
  }
}
// Gå till en menyskärm igen när man backar dit
function navOpen(id) {
  if (id === "s-gallery") return openGallery(true);
  if (id === "s-setup") renderSetupChips();
  if (id === "s-faces") renderFaces();
  show(id, true);
}
addEventListener("popstate", e => {
  if (navSkip) { navSkip = false; return; }
  navDepth = Math.max(0, navDepth - 1);
  if (typeof DANCE !== "undefined" && DANCE.on) { stopDance(); return; }          // bakåt under dansen: sluta dansa, stanna kvar
  if (currentScreen === "s-stage" && ST?.opts.back) { backToGallery(); return; }   // gubbe → galleriet
  if (currentScreen === "s-group" && GR.opts?.back) { backToGallery(); return; }   // gruppbild → galleriet
  if (NAV_GAME.includes(currentScreen) || currentScreen === "s-stage") { navPush({ party: "game" }); return; }
  navOpen(e.state?.party === "screen" ? e.state.id : "s-home");
});
// Tillbaka-länkarna högst upp gör samma sak som bakåtknappen
function goBack() { if (navDepth) history.back(); else show("s-home"); }
document.querySelectorAll(".back-link").forEach(b => b.onclick = goBack);

function show(id, fromNav) {
  if (!fromNav) navTrack(id);
  currentScreen = id;
  if (id !== "s-home") stopIntro();
  if (typeof syncMusic === "function") syncMusic(id);
  if (typeof stopDance === "function") stopDance();   // dansen slutar när man byter skärm
  if (typeof syncMoreBelow === "function") setTimeout(syncMoreBelow);
  $("mapSheet").hidden = id !== "s-gallery";   // kartpanelen hör bara till galleriet
  document.body.classList.toggle("has-sheet", id === "s-gallery");
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === id));
  document.body.classList.toggle("night", id === "s-stage" || id === "s-group");
  if (id !== "s-stage" && id !== "s-group") particles = [];
  scrollTo(0, 0);
}

/* ---------- Inställningar ---------- */
// online: "new" = nytt onlinespel, "join" = gå med i en omgång, "" = inte valt än
// time: sekunder per del, 0 = ingen tidsgräns
// power: power-läget, flera gubbar samtidigt (bara online)
const S = { players: 3, parts: 3, dir: "v", mode: "online", order: "strict", cat: "free", online: "", time: 60, power: false };
const TIMES = [30, 60, 90, 120, 0];
const timeLabel = v => v ? (v < 120 ? v + " s" : v / 60 + " min") : t("noLimit");
function chips(id, opts, key) {
  const box = $(id); box.innerHTML = "";
  opts.forEach(o => {
    const b = document.createElement("button"); b.className = "chip";
    b.textContent = o.label; b.disabled = !!o.disabled;
    b.setAttribute("aria-pressed", S[key] === o.v);
    b.onclick = () => { S[key] = o.v; renderSetupChips(); };
    box.appendChild(b);
  });
}
function renderSetupChips() {
  if (S.cat === "staff" && (!faces.length || (S.power && S.mode === "online"))) S.cat = "free";
  S.parts = S.players; // antalet spelare styr antalet delar
  // Online är förvalt, att spela i rummet är tillvalet
  chips("c-mode", [{ v: "online", label: t("online") }, { v: "room", label: t("room") }], "mode");
  chips("c-players", [3, 4, 5, 6].map(v => ({ v, label: v })), "players");
  chips("c-dir", [{ v: "v", label: "↓ " + t("vertical") }, { v: "h", label: "→ " + t("horizontal") }], "dir");
  chips("c-order", [{ v: "strict", label: t("strict") }, { v: "random", label: t("random") }], "order");
  chips("c-time", TIMES.map(v => ({ v, label: timeLabel(v) })), "time");
  const power = S.power && S.mode === "online";
  chips("c-power", [{ v: false, label: t("powerOff") }, { v: true, label: "⚡ " + t("powerOn") }], "power");
  $("powerRow").hidden = S.mode !== "online";
  chips("c-cat", [{ v: "free", label: t("free") }, { v: "staff", label: t("staff"), disabled: !faces.length || power }], "cat");
  $("catHint").textContent = power ? t("powerNoStaff") : faces.length ? t("staffHint") : t("staffNone");
  $("setupParts").textContent = partsInfo(S.dir, S.players) + (power ? " " + t("powerParts", { n: S.players }) : "");
  // Online väljer man först nytt onlinespel eller att gå med i en omgång som väntar på spelare
  const online = S.mode === "online";
  chips("c-online", [{ v: "new", label: t("newOnline") }, { v: "join", label: t("joinRound") }], "online");
  $("onlinePanel").hidden = !online;
  $("onlineWho").hidden = !online || !S.online;
  $("pwRow").hidden = !(caps.onlinePw && !lsGet(PW_KEY)) && $("pwRow").hidden;
  $("openWrap").hidden = !online || S.online !== "join";
  $("setupOpts").hidden = online && S.online !== "new";
  if (typeof renderNotify === "function") renderNotify();
  $("roomCity").hidden = online;
  $("setupNext").textContent = online ? t("createBtn") : t("next");
  syncOpenList();
}
$("goSetup").onclick = () => { locate(); S.online = ""; $("setupErr").textContent = ""; $("onlineErr").textContent = ""; renderSetupChips(); show("s-setup"); };
$("setupNext").onclick = () => {
  if (S.mode === "room") { renderNameInputs(); show("s-names"); }
  else createOnline();
};

/* ---------- Spel i rummet ---------- */
const G = {};
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function makeAssign(nParts, ids, random) {
  const out = [];
  while (out.length < nParts) {
    const round = random ? shuffle([...ids]) : [...ids];
    if (random && out.length && round.length > 1 && round[0] === out[out.length - 1]) round.push(round.shift());
    out.push(...round);
  }
  return out.slice(0, nParts);
}
function renderNameInputs() {
  const box = $("nameInputs"), old = [...box.querySelectorAll("input")].map(i => i.value);
  box.innerHTML = "";
  for (let i = 0; i < S.players; i++) {
    const id = "pn" + i, l = document.createElement("label");
    l.className = "sr"; l.htmlFor = id; l.textContent = t("player", { n: i + 1 });
    const inp = document.createElement("input"); inp.type = "text"; inp.id = id; inp.placeholder = t("player", { n: i + 1 }); inp.value = old[i] || ""; inp.autocomplete = "off";
    box.append(l, inp);
  }
}
$("namesGo").onclick = async () => {
  const names = [...$("nameInputs").querySelectorAll("input")].map((i, n) => i.value.trim() || t("player", { n: n + 1 }));
  await locate();
  startRoom(names);
};
function startRoom(names) {
  Object.assign(G, {
    mode: "room", dir: S.dir, n: S.parts, cat: S.cat, home: HERE.key || EASTER_ISLAND, time: S.time, hands: [],
    names, assign: makeAssign(S.parts, names.map((_, i) => i), S.order === "random"), idx: 0, parts: [],
    face: S.cat === "staff" && faces.length ? faces[Math.floor(Math.random() * faces.length)] : null,
    name: "", galleryId: null
  });
  roomTurn();
}
// Texterna på överlämningen. Körs igen om man byter språk.
function renderHand() {
  const i = G.idx, who = G.names[G.assign[i]], part = t(partKey(G.dir, G.n, i));
  $("handTitle").textContent = t("handTo", { name: who });
  $("handText").textContent = t("handPart", { name: who, part: lc(part) });
  $("foldShout").hidden = i === 0;
  $("handParts").textContent = partsInfo(G.dir, G.n);
}
function roomTurn() {
  const i = G.idx, who = G.names[G.assign[i]];
  renderHand();
  $("handReady").onclick = () => {
    const go = () => openDraw({ dir: G.dir, i, n: G.n, who, whoKey: "r" + G.assign[i], prev: i ? G.parts[i - 1] : null, online: false,
      time: G.time, handsPrev: i ? G.hands[i - 1] : undefined,
      onDone: (s, extra) => { G.parts[i] = s; G.hands[i] = extra?.hands; G.idx++; if (G.idx < G.n) roomTurn(); else roomStage(); } });
    if (G.face && i === headIndex(G.dir, G.n)) showFace(G.face, go); else go();
  };
  show("s-handoff");
}
async function showFace(face, then) {
  $("faceText").textContent = t("faceText", { name: face.name });
  $("faceText").dataset.face = face.name;   // så att texten kan översättas om man byter språk
  $("faceImg").src = faceSrc(face); $("faceImg").alt = face.name;
  show("s-face");
  for (let n = 5; n > 0; n--) { $("faceCount").textContent = n; await sleep(1000); }
  $("faceImg").removeAttribute("src");
  then();
}
function roomStage() {
  openStage({ parts: G.parts, dir: G.dir, home: G.home, by: G.names.join(", "), staff: G.face?.name, name: "" }, {
    canUnfold: true,
    guess: G.face ? { answer: G.face.name, hint: () => t("guessRoomHint", { name: G.names[G.assign[headIndex(G.dir, G.n)]] }) } : null,
    afterShow: async rec => {
      const r = await aiName(rec);
      rec.what = r.what;
      setStageName(r.name);
    },
    // Spara med namnet i rutan, eller radera (då sparas ingenting)
    decide: {
      keep: async name => { G.name = name; ST.rec.galleryId = G.galleryId = await saveGallery({ name, what: ST.rec.what || "", dir: G.dir, parts: G.parts.map(s => ({ s })), home: G.home, names: G.names, staff: G.face?.name || "", mode: "room", createdAt: new Date().toISOString() }); },
      drop: async () => {}
    },
    again: () => startRoom(G.names)
  });
}
