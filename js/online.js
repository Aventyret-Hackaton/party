// Onlinespel: lobby, turordning och gemensam avtäckning.

/* ---------- Onlinespel ---------- */
let ON = null;
function genCode() { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ"; let s = ""; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
function onlineReady() { return caps.db && caps.uid && caps.canWrite; }
async function createOnline() {
  if (!onlineReady()) { $("setupErr").textContent = t("needDb"); return; }
  $("setupNext").disabled = true;
  try {
    let code = genCode();
    for (let i = 0; i < 5; i++) { const g = await caps.db.doc("games/" + code).get(); if (!g.exists) break; code = genCode(); }
    await caps.db.doc("games/" + code).set({
      host: caps.uid, players: S.players, n: S.parts, dir: S.dir, order: S.order, cat: S.cat,
      status: "lobby", current: 0, createdAt: new Date().toISOString()
    });
    await caps.db.doc(`games/${code}/players/${caps.uid}`).set({ city: $("citySel").value, at: Date.now() });
    enterGame(code);
  } catch (e) { console.warn(e); $("setupErr").textContent = t("needDb"); }
  $("setupNext").disabled = false;
}
$("goJoin").onclick = () => { $("joinErr").textContent = onlineReady() ? "" : t("needDb"); show("s-join"); };
$("joinBtn").onclick = async () => {
  if (!onlineReady()) { $("joinErr").textContent = t("needDb"); return; }
  const code = $("joinCode").value.trim().toUpperCase();
  if (code.length !== 4) { $("joinErr").textContent = t("notFound"); return; }
  try {
    const g = await caps.db.doc("games/" + code).get();
    if (!g.exists) { $("joinErr").textContent = t("notFound"); return; }
    const gd = g.data(), ps = await caps.db.collection(`games/${code}/players`).get();
    const already = ps.docs.some(d => d.id === caps.uid);
    if (!already && gd.status !== "lobby") { $("joinErr").textContent = t("started"); return; }
    if (!already && ps.size >= gd.players) { $("joinErr").textContent = t("full"); return; }
    if (!already) await caps.db.doc(`games/${code}/players/${caps.uid}`).set({ city: $("joinCity").value, at: Date.now() });
    enterGame(code);
  } catch (e) { console.warn(e); $("joinErr").textContent = t("needDb"); }
};
function enterGame(code) {
  leaveOnline();
  ON = { code, game: null, players: [], names: {}, view: "", unsub: [], sent: {} };
  $("lobbyCode").textContent = code;
  ON.unsub.push(caps.db.collection(`games/${code}/players`).onSnapshot(async s => {
    ON.players = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.at - b.at);
    await resolveNames(ON.players.map(p => p.id));
    if (ON?.game?.status === "lobby") renderLobby();
    if (currentScreen === "s-wait") renderWait();
  }, () => {}));
  ON.unsub.push(caps.db.doc("games/" + code).onSnapshot(s => { if (s.exists && ON) { ON.game = s.data(); handleGame(); } }, () => {}));
}
function leaveOnline() { if (ON) { ON.unsub.forEach(u => { try { u(); } catch (e) {} }); ON = null; } }
async function resolveNames(ids) {
  if (!caps.user || !ids.length) return;
  try { const ps = await caps.user.profiles(ids); ids.forEach(id => { if (ps[id]?.name) ON.names[id] = ps[id].name; }); } catch (e) {}
}
function nameOf(id) {
  if (!ON) return "";
  const i = ON.players.findIndex(p => p.id === id);
  const n = ON.names[id] || t("player", { n: i + 1 });
  return id === caps.uid ? `${n} (${t("you")})` : n;
}
const isHost = () => ON?.game?.host === caps.uid;
function renderLobby() {
  if (!ON?.game) return;
  const g = ON.game;
  $("joinedLbl").textContent = t("joined", { n: ON.players.length, m: g.players });
  $("lobbyList").innerHTML = "";
  ON.players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${nameOf(p.id)}${p.id === g.host ? " · " + t("host") : ""} – ${placeLabel(p.city)}`;
    $("lobbyList").appendChild(li);
  });
  $("lobbyStart").hidden = !isHost();
  $("lobbyStart").disabled = ON.players.length < 2;
  $("lobbyNote").textContent = isHost() ? t("hostStartHint") : t("hostWait");
}
$("lobbyStart").onclick = async () => {
  const g = ON.game, ids = ON.players.map(p => p.id);
  const face = g.cat === "staff" && faces.length ? faces[Math.floor(Math.random() * faces.length)] : null;
  await caps.db.doc("games/" + ON.code).update({
    status: "drawing", current: 0, order: makeAssign(g.n, ids, g.order === "random"), playerIds: ids,
    home: midpointCity(ON.players.map(p => p.city)), faceId: face ? face.id : null, faceName: face ? face.name : null
  });
};
$("lobbyLeave").onclick = () => { leaveOnline(); show("s-home"); };

async function handleGame() {
  const g = ON.game;
  if (g.status === "lobby") { if (ON.view !== "lobby") { ON.view = "lobby"; show("s-lobby"); } renderLobby(); return; }
  if (g.status === "drawing") {
    const i = g.current;
    if (g.order[i] === caps.uid && !ON.sent[i]) {
      if (ON.view !== "draw" + i) { ON.view = "draw" + i; startOnlineTurn(i); }
    } else { if (ON.view !== "wait") { ON.view = "wait"; show("s-wait"); } renderWait(); }
    return;
  }
  if (g.status === "done" || g.status === "revealed") {
    if (!ON.stageRec) {
      if (ON.loading) return;
      ON.loading = true;
      const snaps = await Promise.all(Array.from({ length: g.n }, (_, i) => caps.db.doc(`games/${ON.code}/parts/${i}`).get()));
      const by = (g.playerIds || []).map(nameOf).join(", ");
      if (!ON) return;
      ON.stageRec = { parts: snaps.map(s => (s.data() || {}).s || []), dir: g.dir, home: g.home, by, staff: g.faceName || "", name: g.name || "", mid: true };
      ON.loading = false;
      return handleGame();
    }
    if (ON.view !== "stage") {
      ON.view = "stage";
      const code = ON.code;
      openStage(ON.stageRec, {
        canUnfold: isHost() && g.status === "done",
        onUnfoldClick: () => caps.db.doc("games/" + code).update({ status: "revealed", revealAt: Date.now() }),
        afterShow: async rec => {
          if (!isHost() || ON?.game?.name) return;
          const r = await aiName(rec);
          await caps.db.doc("games/" + code).update({ name: r.name, what: r.what });
          const gid = await saveGallery({ name: r.name, what: r.what, dir: rec.dir, parts: rec.parts.map(s => ({ s })), home: rec.home, uids: ON.game.playerIds, staff: rec.staff, mode: "online", createdAt: new Date().toISOString() });
          if (gid) await caps.db.doc("games/" + code).update({ galleryId: gid });
        },
        onRename: async name => {
          await caps.db.doc("games/" + code).update({ name });
          if (ON?.game?.galleryId) await renameGallery(ON.game.galleryId, name);
        },
        again: null
      });
    }
    if (g.status === "revealed" && !ON.showStarted) { ON.showStarted = true; playShow(); }
    if (g.name && ST && ST.shown && ST.rec.name !== g.name) setStageName(g.name);
  }
}
function renderWait() {
  const g = ON?.game; if (!g || g.status !== "drawing") return;
  $("waitProg").innerHTML = Array.from({ length: g.n }, (_, i) => `<span class="${i < g.current ? "done" : ""}"></span>`).join("");
  $("waitText").textContent = t("waitTurn", { name: nameOf(g.order[g.current]), part: lc(t(partKey(g.dir, g.n, g.current))) });
  const mine = g.order.map((u, i) => u === caps.uid && i > g.current ? lc(t(partKey(g.dir, g.n, i))) : null).filter(Boolean);
  $("waitMine").textContent = mine.length ? t("yourNext", { parts: mine.join(", ") }) : (g.order.includes(caps.uid) ? "" : t("noTurn"));
}
async function startOnlineTurn(i) {
  const g = ON.game, code = ON.code;
  let prev = null;
  if (i > 0) { try { prev = ((await caps.db.doc(`games/${code}/parts/${i - 1}`).get()).data() || {}).s || []; } catch (e) { prev = []; } }
  const go = () => openDraw({ dir: g.dir, i, n: g.n, who: nameOf(caps.uid), whoKey: "me", prev, online: true,
    onDone: async s => {
      ON.sent[i] = true; ON.view = "wait"; show("s-wait"); renderWait();
      const doc = fitSize({ s: [{ s }] }, "s"); // komprimera vid behov
      await caps.db.doc(`games/${code}/parts/${i}`).set({ s: doc.s[0].s });
      await caps.db.doc("games/" + code).update(i + 1 < g.n ? { current: i + 1 } : { status: "done" });
    } });
  const face = g.faceId && faces.find(f => f.id === g.faceId);
  if (face && i === headIndex(g.dir, g.n)) showFace(face, go); else go();
}
