// Avtäckningen: strålkastare, utvikning och namnet.

/* ---------- Scenen: avtäckningen ---------- */
let ST = null;
function openStage(rec, opts) {
  // decide: värden väljer att spara eller radera gubben efter avtäckningen. Utan decide är det redan bestämt.
  ST = { rec, opts, shown: false, decided: !opts.decide };
  const fig = $("figure"); fig.className = "figure " + rec.dir; fig.innerHTML = ""; fig.style.setProperty("--n", rec.parts.length);
  const scale = Math.min(2, (devicePixelRatio || 1) * 1.2);
  // Mörkt bläck får en ljus strålkastare bakom sig, ljust bläck står på den mörka scenen.
  $("stage").dataset.ink = inkLightness(rec.parts) < 0.12 ? "dark" : "light";
  rec.parts.forEach((s, i) => {
    const c = partCanvas(s, rec.dir, scale, true); c.className = "fold closed";
    c.setAttribute("aria-label", t(partKey(rec.dir, rec.parts.length, i)));
    fig.appendChild(c);
  });
  $("stage").classList.remove("lit");
  $("preShow").hidden = false;
  $("postShow").hidden = true;
  $("unfoldBtn").textContent = opts.replay ? t("replay") : t("unfold");
  $("unfoldBtn").hidden = !opts.canUnfold;
  $("stageWait").textContent = opts.canUnfold ? "" : t("stageWait");
  $("againBtn").hidden = !opts.again;
  $("decideBox").hidden = true;
  $("decideMsg").textContent = "";
  $("stageActions").hidden = !ST.decided;
  $("keepBtn").disabled = $("dropBtn").disabled = false;
  show("s-stage");
}
$("unfoldBtn").onclick = () => { if (ST.opts.onUnfoldClick) ST.opts.onUnfoldClick(); else playShow(); };
async function playShow() {
  if (!ST || ST.playing) return;
  ST.playing = true;
  const rec = ST.rec;
  $("unfoldBtn").hidden = true; $("stageWait").textContent = "";
  $("postShow").hidden = true;
  [...$("figure").children].forEach(c => c.classList.add("closed"));
  $("stage").classList.add("lit");
  if (!reduceMotion) { smoke(); fxStart(); }
  drumroll(1.8);
  await sleep(reduceMotion ? 200 : 1900);
  $("preShow").hidden = true;
  fanfare();
  if (!reduceMotion) { confetti(); fxStart(); }
  const folds = [...$("figure").children];
  for (const f of folds) { f.classList.remove("closed"); await sleep(reduceMotion ? 0 : 280); }
  $("postShow").hidden = false;
  $("figPlace").textContent = rec.home ? t("livesIn", { place: placeLabel(rec.home) }) + (rec.mid ? ` (${t("midNote")})` : "") : "";
  $("figBy").textContent = rec.by ? t("drawnBy", { names: rec.by }) : "";
  if (rec.name) setStageName(rec.name);
  else { $("figName").textContent = t("naming"); $("figName").classList.add("blur"); }
  if (!ST.decided) { $("decideBox").hidden = false; $("keepBtn").disabled = !rec.name; }
  ST.playing = false;
  if (!ST.shown) { ST.shown = true; if (ST.opts.afterShow) ST.opts.afterShow(rec); }
}
function setStageName(name) {
  if (!ST) return;
  ST.rec.name = name;
  const el = $("figName"); el.textContent = name || t("nameless");
  requestAnimationFrame(() => el.classList.remove("blur"));
  $("renameIn").value = name || "";
  $("keepBtn").disabled = false;
}
// Namnet på scenen följer med när man skriver i rutan
$("renameIn").oninput = () => { $("figName").textContent = $("renameIn").value.trim() || ST?.rec.name || t("nameless"); };
async function decideStage(keep) {
  if (!ST || ST.decided) return;
  const name = $("renameIn").value.trim() || ST.rec.name || t("nameless");
  if (keep) setStageName(name);
  $("keepBtn").disabled = $("dropBtn").disabled = true;
  $("decideMsg").textContent = "";
  try {
    await (keep ? ST.opts.decide.keep(name) : ST.opts.decide.drop());
  } catch (e) {
    console.warn(e);
    $("decideMsg").textContent = typeof onlineError === "function" ? onlineError(e) : t("onlineFail");
    $("keepBtn").disabled = $("dropBtn").disabled = false;
    return;
  }
  ST.decided = true;
  $("decideBox").hidden = true;
  $("decideMsg").textContent = t(keep ? "keptFig" : "droppedFig");
  $("stageActions").hidden = false;
}
$("keepBtn").onclick = () => decideStage(true);
$("dropBtn").onclick = () => decideStage(false);
$("againBtn").onclick = () => ST?.opts.again?.();
$("stageGallery").onclick = () => { leaveOnline(); openGallery(); };
$("stageHome").onclick = () => { leaveOnline(); show("s-home"); };
