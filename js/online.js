// Onlinespel via vår egen server (online-server.js): öppna omgångar, väntrum,
// turordning och gemensam avtäckning. Spelet frågar servern om läget varannan sekund.

/* ---------- Anrop till servern ---------- */
let ON = null;
const PW_KEY = "party-pw", NAME_KEY = "party-name";
const lsGet = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

async function api(method, url, body) {
  const headers = { "Content-Type": "application/json" };
  const pw = $("onPw").value || lsGet(PW_KEY);
  if (pw) headers["X-Party-Password"] = pw;
  if (ON && ON.me) { headers["X-Player"] = ON.me.playerId; headers["X-Key"] = ON.me.key; }
  const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store", keepalive: /\/leave$/.test(url) });
  let data = null; try { data = await r.json(); } catch (e) {}
  const v = r.headers.get("X-App-Version");
  if (v && caps.version && v !== caps.version) showUpdate();
  if (r.status === 401) { $("pwRow").hidden = false; if (pw === lsGet(PW_KEY)) lsSet(PW_KEY, ""); throw Object.assign(new Error("pw"), { code: "pw", status: 401 }); }
  if (!r.ok) throw Object.assign(new Error(data?.error || "fel"), { code: data?.error, status: r.status });
  if (pw && pw !== lsGet(PW_KEY)) lsSet(PW_KEY, pw);    // lösenordet fungerade, kom ihåg det
  return data;
}
// En ny version av spelet har kommit ut medan sidan var öppen. Alla bör ha samma version.
function showUpdate() { $("updateBar").hidden = false; }
$("updateBtn").onclick = () => { leaveOnline(); location.reload(); };
// Delens namn i en onlineomgång. Servern bestämmer delarna, så alla ser samma.
const gPart = (g, i) => (g.keys && g.keys[i]) || partKey(g.dir, g.n, i);
function onlineError(e) {
  const k = e.code === "pw" ? ($("onPw").value || lsGet(PW_KEY) ? "wrongPw" : "pwNeeded") : e.code === "full" ? "full" : e.code === "started" ? "started"
    : e.status === 404 ? "gameGone" : e instanceof TypeError ? "noServer" : "onlineFail";
  return t(k);
}
const myName = () => $("onName").value.trim();
function needName(errEl) {
  if (myName()) { lsSet(NAME_KEY, myName()); return false; }
  errEl.textContent = t("nameNeeded"); $("onName").focus();
  return true;
}
const gameSummary = g => [g.dir === "v" ? "↓ " + t("vertical") : "→ " + t("horizontal"), g.orderMode === "random" ? t("random") : t("strict"), g.cat === "staff" ? t("staff") : t("free")].join(" · ");

/* ---------- Listan med öppna omgångar ---------- */
let openTimer = null;
function syncOpenList() {
  const want = S.mode === "online" && S.online === "join";
  if (!want) { clearInterval(openTimer); openTimer = null; return; }
  if (openTimer) return;
  loadOpenList();
  openTimer = setInterval(() => {
    if (currentScreen !== "s-setup" || S.mode !== "online" || S.online !== "join") { clearInterval(openTimer); openTimer = null; return; }
    if (!document.hidden) loadOpenList();
  }, 3000);
}
async function loadOpenList() {
  await apiReady;
  const box = $("openList");
  if (!caps.api) { box.innerHTML = `<p class="fine">${t("noServer")}</p>`; return; }
  try {
    renderOpenList(await api("GET", "/api/games"));
    if ($("onlineErr").dataset.from === "list") $("onlineErr").textContent = "";
  } catch (e) {
    box.innerHTML = "";
    $("onlineErr").textContent = onlineError(e); $("onlineErr").dataset.from = "list";
  }
}
function renderOpenList(list) {
  const box = $("openList"); box.innerHTML = "";
  if (!list.length) { box.innerHTML = `<p class="fine">${t("noOpen")}</p>`; return; }
  list.forEach(g => {
    const row = document.createElement("div"); row.className = "gamerow";
    const info = document.createElement("div");
    const title = document.createElement("b"); title.textContent = t("gameBy", { name: g.hostName });
    const where = document.createElement("span"); where.textContent = placeLabel(g.hostCity);
    const what = document.createElement("span"); what.textContent = gameSummary(g);
    const who = document.createElement("span"); who.className = "who-in"; who.textContent = t("inGame", { names: (g.names || [g.hostName]).join(", ") });
    const seats = document.createElement("span"); seats.className = "seats";
    // En omgång där någon har lämnat och en ny spelare får ta över
    seats.textContent = g.seeking ? t("seekingRow") : t("seatsLeft", { n: g.max - g.joined, m: g.max });
    info.append(title, who, where, what, seats);
    const b = document.createElement("button"); b.className = "btn primary small"; b.textContent = t("joinBtn");
    b.onclick = () => joinOnline(g.id, b);
    row.append(info, b);
    box.appendChild(row);
  });
}

/* ---------- Starta egen omgång eller gå med ---------- */
async function createOnline() {
  if (needName($("setupErr"))) return;
  $("setupNext").disabled = true;
  try {
    enterGame(await api("POST", "/api/games", { name: myName(), city: await locate(), loc: HERE.loc || null, players: S.players, dir: S.dir, order: S.order, cat: S.cat }));
  } catch (e) {
    $("setupErr").textContent = onlineError(e);
    if (e.code === "pw") $("onPw").focus();
  }
  $("setupNext").disabled = false;
}
async function joinOnline(id, btn) {
  if (needName($("onlineErr"))) return;
  btn.disabled = true;
  try { enterGame(await api("POST", `/api/games/${id}/join`, { name: myName(), city: await locate() })); }
  catch (e) { $("onlineErr").textContent = onlineError(e); $("onlineErr").dataset.from = "join"; btn.disabled = false; loadOpenList(); }
}

/* ---------- I omgången ---------- */
function enterGame(r) {
  leaveOnline();
  ON = { me: { playerId: r.playerId, key: r.key }, game: null, v: 0, view: "", sent: {}, timer: null };
  applyGame(r.game);
  ON.timer = setInterval(pollGame, 2000);
  registerPush(r.game.id);   // push-notiser från servern, se js/notiser.js
}
async function pollGame() {
  // I väntrummet frågar vi även när sidan ligger i bakgrunden, annars tror servern att man har gått.
  // Med notiser på frågar vi alltid, så att notisen om gubben kommer fram.
  if (!ON || (document.hidden && ON.game?.status !== "lobby" && !notifyOn())) return;
  const on = ON;
  try {
    const s = await api("GET", `/api/games/${on.game.id}?v=${on.v}`);
    if (ON === on && !s.same) applyGame(s);
  } catch (e) {
    if (ON !== on || !(e.status === 404 || e.status === 403)) return;
    ON = null; clearInterval(on.timer);
    S.mode = "online"; S.online = "join"; renderSetupChips(); show("s-setup");
    $("onlineErr").textContent = t("gameGone"); $("onlineErr").dataset.from = "game";
  }
}
function applyGame(g) { ON.game = g; ON.v = g.v; handleGame(); }
function leaveOnline() {
  if (!ON) return;
  clearInterval(ON.timer);
  // Lämnar man mitt i får de andra veta det och välja hur de fortsätter
  if (ON.game && !["saved", "deleted", "ended"].includes(ON.game.status)) api("POST", `/api/games/${ON.game.id}/leave`).catch(() => {});
  ON = null;
}
addEventListener("pagehide", () => leaveOnline());

const meId = () => ON?.me.playerId;
// De som faktiskt ritade, i turordning (inte de som lämnade innan de hann rita)
// Gissa vilken Äventyrare: alla utom den som ritade huvudet
const gHead = g => g.keys?.length ? g.keys.findIndex(k => k === "head" || k === "headfront") : headIndex(g.dir, g.n);
const guessFor = g => g.face && g.turns[gHead(g)] !== meId() ? { answer: g.face.name } : null;
const drawers = g => [...new Set(g.turns)].map(id => g.players.find(p => p.id === id)?.name).filter(Boolean);
const isHost = () => ON?.game?.hostId === meId();
function nameOf(id) {
  if (!ON?.game) return "";
  const i = ON.game.players.findIndex(p => p.id === id);
  const n = ON.game.players[i]?.name || t("player", { n: i + 1 });
  return id === meId() ? `${n} (${t("you")})` : n;
}
function renderLobby() {
  const g = ON?.game; if (!g) return;
  $("lobbyInfo").textContent = gameSummary(g);
  $("lobbyParts").textContent = partsInfo(g.dir, g.n, g.keys);
  $("joinedLbl").textContent = t("joined", { n: g.players.length, m: g.max });
  if (typeof renderShout === "function") renderShout();
  $("lobbyList").innerHTML = "";
  g.players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${nameOf(p.id)}${p.id === g.hostId ? " · " + t("host") : ""} – ${placeLabel(p.city)}`;
    $("lobbyList").appendChild(li);
  });
  $("lobbySeats").innerHTML = Array.from({ length: g.max }, (_, i) => `<span class="${i < g.players.length ? "done" : ""}"></span>`).join("");
  $("lobbyNote").textContent = t("waitFull", { m: g.max });
}
$("lobbyLeave").onclick = () => { leaveOnline(); show("s-home"); };
$("waitHome").onclick = () => { leaveOnline(); show("s-home"); };
$("waitAgain").onclick = () => playAgainOnline();

/* ---------- Spela igen ---------- */
// Den första som trycker startar en ny omgång med samma inställningar. De andra hamnar i samma omgång.
async function playAgainOnline() {
  if (!ON) return;
  const btns = [$("againBtn"), $("waitAgain")];
  btns.forEach(b => b.disabled = true);
  try {
    const r = await api("POST", `/api/games/${ON.game.id}/again`, { name: lsGet(NAME_KEY) || myName() || t("player", { n: 1 }), city: await locate(), loc: HERE.loc || null });
    enterGame(r);
  } catch (e) {
    $(currentScreen === "s-stage" ? "decideMsg" : "waitText").textContent = onlineError(e);
  }
  btns.forEach(b => b.disabled = false);
}
// Visa att någon annan redan har startat nästa omgång
function renderNext() {
  const note = ON?.game?.next ? t("playAgainOnline") : "";
  $("againNote").textContent = note; $("waitAgainNote").textContent = note;
}
$("waitLeave").onclick = () => { leaveOnline(); show("s-home"); };

/* ---------- Någon har lämnat omgången ---------- */
function renderPause() {
  const g = ON?.game; if (!g) return;
  const mine = g.players.find(p => p.id === meId());
  const ended = g.status === "ended", out = !!mine?.left && !ended, seeking = g.status === "seeking";
  const goneNames = (g.gone || []).map(id => g.players.find(p => p.id === id)?.name).filter(Boolean).join(", ");
  $("pauseHead").textContent = t(ended ? "endedTitle" : out ? "youLeftTitle" : "pauseTitle");
  $("pauseText").textContent = ended ? t("endedText", { name: nameOf(g.hostId) }) : out ? t("youLeftText") : t("playerLeft", { names: goneNames });
  $("pauseNote").textContent = ended || out ? "" : seeking ? t("seekingNote") : isHost() ? t("pauseAsk") : t("pauseHostDecides", { name: nameOf(g.hostId) });
  $("pauseChoices").hidden = ended || out || !isHost();
  $("pauseWait").hidden = seeking;
  $("pauseLeave").textContent = t(ended || out ? "home" : "leave");
  $("pauseErr").textContent = "";
}
async function resolvePause(choice) {
  if (!ON) return;
  const btns = [$("pauseShare"), $("pauseWait"), $("pauseEnd")];
  btns.forEach(b => b.disabled = true);
  try { const s = await api("POST", `/api/games/${ON.game.id}/resolve`, { choice }); if (ON) applyGame(s); }
  catch (e) { $("pauseErr").textContent = onlineError(e); }
  btns.forEach(b => b.disabled = false);
}
$("pauseShare").onclick = () => resolvePause("share");
$("pauseWait").onclick = () => resolvePause("wait");
$("pauseEnd").onclick = () => resolvePause("end");
$("pauseLeave").onclick = () => { leaveOnline(); show("s-home"); };

function handleGame() {
  const g = ON.game;
  renderNext();
  if (ON.view === "lobby" && g.status !== "lobby") notify(t("notifyFullTitle"), t("notifyFullBody"), "full-" + g.id);
  if (g.status === "lobby") { if (ON.view !== "lobby") { ON.view = "lobby"; show("s-lobby"); } renderLobby(); return; }
  if (g.status === "drawing") {
    const i = g.current;
    if (g.turns[i] === meId() && !ON.sent[i]) {
      if (ON.view !== "draw" + i) { ON.view = "draw" + i; startOnlineTurn(i); }
    } else {
      if (ON.view !== "wait") { ON.view = "wait"; show("s-wait"); }
      renderWait();
    }
    return;
  }
  // Någon har lämnat. Den som håller på att rita sin del får rita klart först.
  const mine = g.players.find(p => p.id === meId());
  if (["paused", "seeking", "ended"].includes(g.status) || mine?.left) {
    const i = g.current;
    if (g.status !== "ended" && !mine?.left && g.turns[i] === meId() && !ON.sent[i] && ON.view === "draw" + i) return;
    if (g.status === "ended" || mine?.left) clearInterval(ON.timer);
    if (ON.view !== "pause") { ON.view = "pause"; show("s-pause"); }
    renderPause();
    return;
  }
  // Värden vecklar ut och bestämmer om gubben ska sparas. De andra väntar och får sedan se den, eller får veta att den raderades.
  if (!isHost()) {
    if (g.status === "saved") {
      if (ON.view !== "stage") {
        ON.view = "stage";
        notify(t("notifyDoneTitle"), t("notifyDoneBody"), "done-" + g.id);
        openStage({ parts: g.parts || [], dir: g.dir, home: g.home, by: drawers(g).join(", "), staff: g.face?.name || "", name: g.name || "", mid: true, galleryId: g.galleryId || "" }, { canUnfold: false, again: playAgainOnline, guess: guessFor(g) });
        playShow();
      }
      return;
    }
    if (ON.view !== "end") { ON.view = "end"; show("s-wait"); }
    renderWait();
    return;
  }
  if (g.status === "done" || g.status === "revealed") {
    if (ON.view !== "stage") {
      ON.view = "stage";
      const id = g.id;
      ON.stageRec = { parts: g.parts || [], dir: g.dir, home: g.home, by: drawers(g).join(", "), staff: g.face?.name || "", name: g.name || "", mid: true };
      openStage(ON.stageRec, {
        canUnfold: isHost() && g.status === "done",
        guess: guessFor(g),
        onUnfoldClick: () => api("POST", `/api/games/${id}/reveal`).then(s => ON && applyGame(s)).catch(() => {}),
        afterShow: async rec => {
          const r = await aiName(rec);
          rec.what = r.what;
          setStageName(r.name);
        },
        decide: {
          keep: async name => {
            const rec = ST.rec;
            const gid = ST.rec.galleryId = await saveGallery({ name, what: rec.what || "", dir: rec.dir, parts: rec.parts.map(s => ({ s })), home: rec.home, names: drawers(ON.game), staff: rec.staff, mode: "online", createdAt: new Date().toISOString() });
            const s = await api("POST", `/api/games/${id}/save`, { name, what: rec.what || "", galleryId: gid || "" });
            if (ON) applyGame(s);
          },
          drop: async () => { const s = await api("POST", `/api/games/${id}/discard`); if (ON) applyGame(s); }
        },
        again: playAgainOnline
      });
    }
  }
  if (g.status === "revealed" && !ON.showStarted) { ON.showStarted = true; playShow(); }
}
function renderWait() {
  const g = ON?.game; if (!g || g.status === "lobby") return;
  const end = g.status !== "drawing", gone = g.status === "deleted";
  $("waitHead").textContent = t(gone ? "droppedTitle" : end ? "decideTitle" : "waitTitle");
  $("waitHome").hidden = !gone;
  $("waitAgain").hidden = !gone;
  $("waitParts").textContent = partsInfo(g.dir, g.n, g.keys);
  $("waitParts").hidden = end;
  $("waitLeave").hidden = gone;
  $("waitProg").innerHTML = Array.from({ length: g.n }, (_, i) => `<span class="${end || i < g.current ? "done" : ""}"></span>`).join("");
  if (end) {
    $("waitText").textContent = t(gone ? "hostDropped" : "hostDeciding", { name: nameOf(g.hostId) });
    $("waitMine").textContent = "";
    return;
  }
  $("waitText").textContent = t("waitTurn", { name: nameOf(g.turns[g.current]), part: lc(t(gPart(g, g.current))) });
  // Vad jag ska rita, och hur många som ritar före mig
  const mineIdx = g.turns.map((u, i) => u === meId() && i > g.current ? i : -1).filter(i => i >= 0);
  const mine = mineIdx.map(i => lc(t(gPart(g, i)))).join(", ");
  const before = mineIdx.length ? mineIdx[0] - g.current : 0;
  $("waitMine").textContent = mineIdx.length ? t(before === 1 ? "yourNext1" : "yourNextN", { parts: mine, n: before })
    : (g.turns.includes(meId()) ? "" : t("noTurn"));
}
function startOnlineTurn(i) {
  const g = ON.game, id = g.id;
  const go = () => openDraw({ dir: g.dir, i, n: g.n, key: gPart(g, i), who: nameOf(meId()), whoKey: "me", prev: i > 0 ? (g.prev || []) : null, online: true,
    onDone: async s => {
      if (!ON) return;
      ON.sent[i] = true; ON.view = "wait"; show("s-wait"); renderWait();
      const doc = fitSize({ s: [{ s }] }, "s"); // komprimera vid behov
      try { const st = await api("POST", `/api/games/${id}/part`, { i, s: doc.s[0].s }); if (ON) applyGame(st); }
      catch (e) { console.warn(e); if (ON) { ON.sent[i] = false; ON.view = ""; ON.v = 0; $("waitText").textContent = onlineError(e); } }
    } });
  if (g.face && i === gHead(g)) showFace(g.face, go); else go();
}

$("onName").value = lsGet(NAME_KEY);
// Ladda om listan så fort lösenordet är ifyllt
$("onPw").addEventListener("change", () => loadOpenList());
$("onPw").addEventListener("keydown", e => { if (e.key === "Enter") loadOpenList(); });
