// Skärmbyten, inställningar och spel i rummet.

/* ---------- Skärmhantering ---------- */
let currentScreen = "s-home";
function show(id) {
  currentScreen = id;
  if (id !== "s-home") stopIntro();
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === id));
  document.body.classList.toggle("night", id === "s-stage");
  if (id !== "s-stage") particles = [];
  scrollTo(0, 0);
}

/* ---------- Inställningar ---------- */
const S = { players: 3, parts: 3, dir: "v", mode: "room", order: "strict", cat: "free" };
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
  if (S.cat === "staff" && !faces.length) S.cat = "free";
  chips("c-players", [3, 4, 5, 6].map(v => ({ v, label: v })), "players");
  chips("c-parts", [3, 4, 5, 6].map(v => ({ v, label: v })), "parts");
  chips("c-dir", [{ v: "v", label: "↓ " + t("vertical") }, { v: "h", label: "→ " + t("horizontal") }], "dir");
  chips("c-mode", [{ v: "room", label: t("room") }, { v: "online", label: t("online") }], "mode");
  chips("c-order", [{ v: "strict", label: t("strict") }, { v: "random", label: t("random") }], "order");
  chips("c-cat", [{ v: "free", label: t("free") }, { v: "staff", label: t("staff"), disabled: !faces.length }], "cat");
  $("catHint").textContent = faces.length ? t("staffHint") : t("staffNone");
  $("cityLbl").textContent = S.mode === "room" ? t("whereRoom") : t("whereMe");
  $("cityHint").textContent = S.mode === "room" ? t("whereRoomHint") : t("whereOnline");
}
$("goSetup").onclick = () => { $("setupErr").textContent = ""; renderSetupChips(); show("s-setup"); };
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
$("namesGo").onclick = () => {
  const names = [...$("nameInputs").querySelectorAll("input")].map((i, n) => i.value.trim() || t("player", { n: n + 1 }));
  startRoom(names);
};
function startRoom(names) {
  Object.assign(G, {
    mode: "room", dir: S.dir, n: S.parts, cat: S.cat, home: $("citySel").value,
    names, assign: makeAssign(S.parts, names.map((_, i) => i), S.order === "random"), idx: 0, parts: [],
    face: S.cat === "staff" && faces.length ? faces[Math.floor(Math.random() * faces.length)] : null,
    name: "", galleryId: null
  });
  roomTurn();
}
function roomTurn() {
  const i = G.idx, who = G.names[G.assign[i]], part = t(partKey(G.dir, G.n, i));
  $("handTitle").textContent = t("handTo", { name: who });
  $("handText").textContent = t("handPart", { name: who, part: lc(part) });
  $("foldShout").hidden = i === 0;
  $("handReady").onclick = () => {
    const go = () => openDraw({ dir: G.dir, i, n: G.n, who, whoKey: "r" + G.assign[i], prev: i ? G.parts[i - 1] : null, online: false,
      onDone: s => { G.parts[i] = s; G.idx++; if (G.idx < G.n) roomTurn(); else roomStage(); } });
    if (G.face && i === headIndex(G.dir, G.n)) showFace(G.face, go); else go();
  };
  show("s-handoff");
}
async function showFace(face, then) {
  $("faceText").textContent = t("faceText", { name: face.name });
  $("faceImg").src = faceSrc(face); $("faceImg").alt = face.name;
  show("s-face");
  for (let n = 5; n > 0; n--) { $("faceCount").textContent = n; await sleep(1000); }
  $("faceImg").removeAttribute("src");
  then();
}
function roomStage() {
  openStage({ parts: G.parts, dir: G.dir, home: G.home, by: G.names.join(", "), staff: G.face?.name, name: "" }, {
    canUnfold: true,
    afterShow: async rec => {
      const r = await aiName(rec);
      setStageName(r.name);
      G.name = r.name;
      G.galleryId = await saveGallery({ name: r.name, what: r.what, dir: G.dir, parts: G.parts.map(s => ({ s })), home: G.home, names: G.names, staff: G.face?.name || "", mode: "room", createdAt: new Date().toISOString() });
    },
    onRename: async name => { G.name = name; if (G.galleryId) await renameGallery(G.galleryId, name); },
    again: () => startRoom(G.names)
  });
}
