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
  if (r.status === 401) { $("pwRow").hidden = false; if (pw === lsGet(PW_KEY)) lsSet(PW_KEY, ""); throw Object.assign(new Error("pw"), { code: "pw", status: 401 }); }
  if (!r.ok) throw Object.assign(new Error(data?.error || "fel"), { code: data?.error, status: r.status });
  if (pw && pw !== lsGet(PW_KEY)) lsSet(PW_KEY, pw);    // lösenordet fungerade, kom ihåg det
  return data;
}
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
    if (!document.hidden || notifyOn()) loadOpenList();
  }, 3000);
}
async function loadOpenList() {
  await apiReady;
  const box = $("openList");
  if (!caps.api) { box.innerHTML = `<p class="fine">${t("noServer")}</p>`; return; }
  try {
    const list = await api("GET", "/api/games");
    renderOpenList(list); watchSeats(list);
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
    seats.textContent = t("seatsLeft", { n: g.max - g.joined, m: g.max });
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
    enterGame(await api("POST", "/api/games", { name: myName(), city: $("onCity").value, players: S.players, dir: S.dir, order: S.order, cat: S.cat }));
  } catch (e) {
    $("setupErr").textContent = onlineError(e);
    if (e.code === "pw") $("onPw").focus();
  }
  $("setupNext").disabled = false;
}
async function joinOnline(id, btn) {
  if (needName($("onlineErr"))) return;
  btn.disabled = true;
  try { enterGame(await api("POST", `/api/games/${id}/join`, { name: myName(), city: $("onCity").value })); }
  catch (e) { $("onlineErr").textContent = onlineError(e); $("onlineErr").dataset.from = "join"; btn.disabled = false; loadOpenList(); }
}

/* ---------- I omgången ---------- */
function enterGame(r) {
  leaveOnline();
  ON = { me: { playerId: r.playerId, key: r.key }, game: null, v: 0, view: "", sent: {}, timer: null };
  applyGame(r.game);
  ON.timer = setInterval(pollGame, 2000);
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
  if (ON.game?.status === "lobby") api("POST", `/api/games/${ON.game.id}/leave`).catch(() => {});
  ON = null;
}
addEventListener("pagehide", () => leaveOnline());

const meId = () => ON?.me.playerId;
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
  $("joinedLbl").textContent = t("joined", { n: g.players.length, m: g.max });
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

function handleGame() {
  const g = ON.game;
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
  if (g.status === "done" || g.status === "revealed") {
    if (ON.view !== "stage") {
      ON.view = "stage";
      notify(t("notifyDoneTitle"), t("notifyDoneBody"), "done-" + g.id);
      const id = g.id;
      ON.stageRec = { parts: g.parts || [], dir: g.dir, home: g.home, by: g.players.map(p => p.name).join(", "), staff: g.face?.name || "", name: g.name || "", mid: true };
      openStage(ON.stageRec, {
        canUnfold: isHost() && g.status === "done",
        onUnfoldClick: () => api("POST", `/api/games/${id}/reveal`).then(s => ON && applyGame(s)).catch(() => {}),
        afterShow: async rec => {
          if (!isHost() || ON?.game?.name) return;
          const r = await aiName(rec);
          setStageName(r.name);
          const gid = await saveGallery({ name: r.name, what: r.what, dir: rec.dir, parts: rec.parts.map(s => ({ s })), home: rec.home, names: ON.game.players.map(p => p.name), staff: rec.staff, mode: "online", createdAt: new Date().toISOString() });
          if (ON) api("POST", `/api/games/${id}/name`, { name: r.name, what: r.what, galleryId: gid || "" }).then(s => ON && applyGame(s)).catch(() => {});
        },
        onRename: async name => {
          if (!ON) return;
          await api("POST", `/api/games/${id}/name`, { name }).catch(() => {});
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
  $("waitText").textContent = t("waitTurn", { name: nameOf(g.turns[g.current]), part: lc(t(partKey(g.dir, g.n, g.current))) });
  const mine = g.turns.map((u, i) => u === meId() && i > g.current ? lc(t(partKey(g.dir, g.n, i))) : null).filter(Boolean);
  $("waitMine").textContent = mine.length ? t("yourNext", { parts: mine.join(", ") }) : (g.turns.includes(meId()) ? "" : t("noTurn"));
}
function startOnlineTurn(i) {
  const g = ON.game, id = g.id;
  const go = () => openDraw({ dir: g.dir, i, n: g.n, who: nameOf(meId()), whoKey: "me", prev: i > 0 ? (g.prev || []) : null, online: true,
    onDone: async s => {
      if (!ON) return;
      ON.sent[i] = true; ON.view = "wait"; show("s-wait"); renderWait();
      const doc = fitSize({ s: [{ s }] }, "s"); // komprimera vid behov
      try { const st = await api("POST", `/api/games/${id}/part`, { i, s: doc.s[0].s }); if (ON) applyGame(st); }
      catch (e) { console.warn(e); if (ON) { ON.sent[i] = false; ON.view = ""; ON.v = 0; $("waitText").textContent = onlineError(e); } }
    } });
  if (g.face && i === headIndex(g.dir, g.n)) showFace(g.face, go); else go();
}

$("onName").value = lsGet(NAME_KEY);
// Ladda om listan så fort lösenordet är ifyllt
$("onPw").addEventListener("change", () => loadOpenList());
$("onPw").addEventListener("keydown", e => { if (e.key === "Enter") loadOpenList(); });
