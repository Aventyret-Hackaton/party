// Power-läget: lika många gubbar som spelare, och alla ritar samtidigt.
//
// I varje runda ritar alla en del, men i olika gubbar. Fyra spelare ger fyra gubbar och fyra rundor:
// i runda 1 ritar alla ett huvud, i runda 2 en överkropp och så vidare, varje gång i en ny gubbe.
// Ingen ritar samma sorts del två gånger. Servern bestämmer vem som ritar vad (online-server.js).
// När alla har ritat sin del börjar nästa runda. Timern gäller hela rundan.
// På slutet vecklar värden ut alla gubbar på en gång, som en gruppbild, ger gänget ett namn och sparar
// eller raderar dem. Gubbarna får inga egna namn, de heter som gänget.

/* ---------- Under omgången ---------- */
// Gubbarna jag ska rita i den här rundan och inte har skickat än
function powerTasks(g) {
  if (g.status !== "drawing" || g.round >= g.n) return [];
  return g.assign[g.round].map((id, f) => id === meId() && !g.drawn[f][g.round] && !ON.sent["p" + g.round + ":" + f] ? f : -1).filter(f => f >= 0);
}
function handlePower(g) {
  const mine = g.players.find(p => p.id === meId());
  const out = !!mine?.left || g.status === "ended";
  // Den som håller på att rita får rita klart även om någon har lämnat under tiden
  if (!out && ON.view.startsWith("pdraw") && !ON.sent["p" + ON.view.slice(5)]) return;
  if (!out && g.status === "drawing") {
    const tasks = powerTasks(g);
    if (tasks.length) { startPowerTurn(g, tasks[0]); return; }
    if (ON.view !== "wait") { ON.view = "wait"; show("s-wait"); }
    renderWait();
    return;
  }
  if (out || g.status === "paused" || g.status === "seeking") {
    if (out) clearInterval(ON.timer);
    if (ON.view !== "pause") { ON.view = "pause"; show("s-pause"); }
    renderPause();
    return;
  }
  // Gruppbilden. De andra får se den först när värden har sparat den.
  if (!isHost()) {
    if (g.status === "saved") {
      if (ON.view !== "group") {
        ON.view = "group";
        notify(t("notifyDoneTitle"), t("notifyDoneBody"), "done-" + g.id);
        openGroup(groupRec(g), { canUnfold: false });
        playGroup();
      }
      return;
    }
    if (ON.view !== "end") { ON.view = "end"; show("s-wait"); }
    renderWait();
    return;
  }
  if (g.status === "done" || g.status === "revealed") {
    if (ON.view !== "group") {
      ON.view = "group";
      const id = g.id;
      openGroup(groupRec(g), {
        canUnfold: g.status === "done",
        onUnfoldClick: () => api("POST", `/api/games/${id}/reveal`).then(s => ON && applyGame(s)).catch(() => {}),
        decide: {
          // Hela gänget sparas som en enda gruppbild i galleriet
          keep: async () => {
            const R = GR.rec;
            const gid = await saveGallery({ kind: "group", name: R.gang, dir: R.dir, figs: R.figs.map(f => f.map(s => ({ s }))), by: R.by,
              names: [...new Set(R.by.flat())], home: R.home, staff: "", mode: "online", createdAt: new Date().toISOString() });
            const s = await api("POST", `/api/games/${id}/save`, { name: R.gang, galleryId: gid || "" });
            if (ON) applyGame(s);
          },
          drop: async () => { const s = await api("POST", `/api/games/${id}/discard`); if (ON) applyGame(s); }
        }
      });
    }
  }
  if (g.status === "revealed" && !ON.showStarted) { ON.showStarted = true; playGroup(); }
}
function startPowerTurn(g, f) {
  const r = g.round, key = r + ":" + f, id = g.id;
  ON.view = "pdraw" + key;
  openDraw({ dir: g.dir, i: r, n: g.n, key: gPart(g, r), fig: f, who: nameOf(meId()), whoKey: "me", prev: r > 0 ? (g.prevP?.[f] || []) : null, online: true,
    time: g.time ?? 60, timeStart: g.turnStart ? g.turnStart - CLOCK.offset : 0,
    handsPrev: r > 0 && g.hands?.[f]?.[r - 1] != null ? g.hands[f][r - 1] : undefined,
    onDone: async (s, extra) => {
      if (!ON) return;
      ON.sent["p" + key] = true; ON.view = "wait"; show("s-wait"); renderWait();
      const doc = fitSize({ s: [{ s }] }, "s");
      try { const st = await api("POST", `/api/games/${id}/part`, { f, i: r, s: doc.s[0].s, hands: extra?.hands }); if (ON) applyGame(st); }
      catch (e) { console.warn(e); if (ON) { ON.sent["p" + key] = false; ON.view = ""; ON.v = 0; $("waitText").textContent = onlineError(e); } }
    } });
}
// Väntskärmen: vilken runda, vilka som ritar fortfarande, och vad jag ritar i nästa runda
function renderPowerWait(g) {
  const r = g.round;
  const busy = [...new Set(g.assign[r].filter((id, f) => !g.drawn[f][r]))].map(nameOf);
  $("waitText").textContent = t("powerRound", { r: r + 1, n: g.n }) + " " + t("powerWaiting", { names: busy.join(", ") });
  const next = r + 1 < g.n && g.assign[r + 1].includes(meId());
  $("waitMine").textContent = next ? t("powerNext", { part: lc(t(gPart(g, r + 1))) }) : "";
}

/* ---------- Gruppbilden ---------- */
const GR = { rec: null, opts: null, decided: false, playing: false };
function groupRec(g) {
  const figs = g.figs || [];
  return { figs, dir: g.dir, home: g.home,
    by: figs.map((_, f) => [...new Set(g.assign.map(row => row[f]))].map(id => g.players.find(p => p.id === id)?.name).filter(Boolean)),
    gang: g.status === "saved" ? g.name : "" };
}
function openGroup(rec, opts) {
  GR.rec = rec; GR.opts = opts; GR.decided = !opts.decide; GR.playing = false;
  const box = $("groupFigs"); box.innerHTML = "";
  const scale = Math.min(2, Math.max(1, devicePixelRatio || 1)) * .45;
  rec.figs.forEach((parts, f) => {
    const fig = document.createElement("figure"); fig.className = "gfig";
    const body = document.createElement("div"); body.className = "mini " + rec.dir;
    parts.forEach(s => { const c = partCanvas(s, rec.dir, scale); c.className = "fold closed"; body.appendChild(c); });
    const cap = document.createElement("figcaption");
    const by = document.createElement("span"); by.textContent = rec.by[f].join(", ");
    cap.append(by);
    fig.append(body, cap);
    box.appendChild(fig);
  });
  $("groupStage").classList.remove("lit");
  // Gängets namn: värden skriver det, de andra ser det som rubrik när gänget är sparat
  setGangTitle(rec.gang);
  $("gangIn").value = "";
  $("groupPre").hidden = false; $("groupPost").hidden = true;
  $("groupUnfold").hidden = !opts.canUnfold;
  $("groupUnfold").textContent = t(opts.back ? "replay" : "unfold");
  // Öppnad från galleriet: bara tillbaka dit
  $("groupAgain").hidden = !!opts.back; $("groupHome").hidden = !!opts.back;
  $("groupGallery").textContent = t(opts.back ? "backGallery" : "toGallery");
  $("groupWait").textContent = opts.canUnfold ? "" : t("stageWait");
  $("groupDecide").hidden = true; $("groupActions").hidden = true; $("groupMsg").textContent = "";
  $("groupKeep").disabled = $("groupDrop").disabled = false;
  show("s-group");
}
$("groupUnfold").onclick = () => { if (GR.opts?.onUnfoldClick) GR.opts.onUnfoldClick(); else playGroup(); };
async function playGroup() {
  if (!GR.rec || GR.playing) return;
  GR.playing = true;
  $("groupUnfold").hidden = true; $("groupWait").textContent = "";
  $("groupStage").classList.add("lit");
  if (!reduceMotion) { smoke(); fxStart(); }
  drumroll(1.8);
  await sleep(reduceMotion ? 200 : 1900);
  $("groupPre").hidden = true;
  fanfare();
  if (!reduceMotion) { confetti(); fxStart(); }
  // Alla gubbar vecklas ut samtidigt, en vikning i taget
  const figs = [...$("groupFigs").children].map(f => [...f.querySelectorAll(".fold")]);
  for (let i = 0; i < Math.max(0, ...figs.map(x => x.length)); i++) {
    figs.forEach(folds => folds[i]?.classList.remove("closed"));
    await sleep(reduceMotion ? 0 : 280);
  }
  $("groupPlace").textContent = GR.rec.home ? t("livesIn", { place: placeLabel(GR.rec.home) }) + ` (${t("midNote")})` : "";
  $("groupPost").hidden = false;
  if (!GR.decided) {
    // Ett förslag på gängets namn, som värden kan skriva om
    if (!$("gangIn").value) $("gangIn").value = t("gangOf", { name: fallbackName().name });
    setGangTitle($("gangIn").value);
    $("groupDecide").hidden = false;
  } else $("groupActions").hidden = false;
  GR.playing = false;
}
function setGangTitle(name) {
  const el = $("groupName");
  el.dataset.i = name ? "" : "groupTitle";   // utan namn: "Gruppbild!", som översätts om man byter språk
  el.textContent = name || t("groupTitle");
}
$("gangIn").oninput = () => setGangTitle($("gangIn").value.trim());
async function decideGroup(keep) {
  if (!GR.opts?.decide || GR.decided) return;
  GR.rec.gang = $("gangIn").value.trim() || t("gangOf", { name: fallbackName().name });
  if (keep) setGangTitle(GR.rec.gang);
  $("groupKeep").disabled = $("groupDrop").disabled = true;
  $("groupMsg").textContent = "";
  try { await (keep ? GR.opts.decide.keep() : GR.opts.decide.drop()); }
  catch (e) {
    console.warn(e);
    $("groupMsg").textContent = onlineError(e);
    $("groupKeep").disabled = $("groupDrop").disabled = false;
    return;
  }
  GR.decided = true;
  $("groupDecide").hidden = true;
  $("groupMsg").textContent = t(keep ? "groupKept" : "groupDropped");
  if (!keep) $("groupFigs").innerHTML = "";
  $("groupActions").hidden = false;
}
$("groupKeep").onclick = () => decideGroup(true);
$("groupDrop").onclick = () => decideGroup(false);
$("groupAgain").onclick = () => playAgainOnline();
$("groupGallery").onclick = () => { if (GR.opts?.back) history.back(); else { leaveOnline(); openGallery(); } };
$("groupHome").onclick = () => { leaveOnline(); show("s-home"); };
