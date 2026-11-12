// Avtäckningen: strålkastare, utvikning och namnet.

/* ---------- Scenen: avtäckningen ---------- */
let ST = null;
function openStage(rec, opts) {
  // decide: värden väljer att spara eller radera gubben efter avtäckningen. Utan decide är det redan bestämt.
  // guess: { answer, hint } – man gissar vilken Äventyrare huvudet föreställer innan namnet visas.
  ST = { rec, opts, shown: false, decided: !opts.decide, guessing: false, guessed: !opts.guess };
  const fig = $("figure"); fig.className = "figure " + rec.dir; fig.innerHTML = ""; fig.style.setProperty("--n", rec.parts.length);
  // En del visas aldrig bredare än 600 punkter på skärmen, så skärmens pixeltäthet räcker för skarpa streck
  const scale = Math.min(3, Math.max(1, devicePixelRatio || 1));
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
  $("stageBack").hidden = !opts.back;   // öppnad från galleriet: tillbaka dit
  $("decideBox").hidden = true;
  $("decideMsg").textContent = "";
  $("guessBox").hidden = true;
  $("guessMsg").textContent = "";
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
  if (!ST.guessed) showGuess(); else revealName();
  ST.playing = false;
  syncMoreBelow();
  if (!ST.shown) { ST.shown = true; if (ST.opts.afterShow) ST.opts.afterShow(rec); }
}
// Namnet, och för värden rutan där gubben sparas eller raderas
function revealName() {
  const rec = ST.rec;
  if (rec.name) setStageName(rec.name);
  else { $("figName").textContent = t("naming"); $("figName").classList.add("blur"); }
  if (!ST.decided) { $("decideBox").hidden = false; $("keepBtn").disabled = !rec.name; }
  $("stageActions").hidden = !ST.decided;
}
function setStageName(name) {
  if (!ST) return;
  ST.rec.name = name;
  $("renameIn").value = name || "";
  $("keepBtn").disabled = false;
  if (ST.guessing) return;   // namnet avslöjar vem det är, så det visas först efter gissningen
  const el = $("figName"); el.textContent = name || t("nameless");
  requestAnimationFrame(() => el.classList.remove("blur"));
}

/* ---------- Gissa vilken Äventyrare ---------- */
// Högst sex namn: det rätta och några slumpade bland de andra Äventyrarna
function guessOptions(answer) {
  const others = shuffle([...new Set(faces.map(f => f.name))].filter(n => n !== answer));
  return shuffle([answer, ...others.slice(0, 5)]);
}
// hint kan vara en funktion, så att texten går att översätta om man byter språk
const guessHintText = () => { const h = ST?.opts.guess?.hint; return (typeof h === "function" ? h() : h) || t("guessHint"); };
function showGuess() {
  const { answer } = ST.opts.guess;
  ST.guessing = true;
  $("stageActions").hidden = true;
  const el = $("figName"); el.textContent = t("guessTitle"); el.classList.remove("blur");
  $("guessHint").textContent = guessHintText();
  const box = $("guessOpts"); box.innerHTML = "";
  guessOptions(answer).forEach(n => {
    const b = document.createElement("button"); b.className = "btn"; b.textContent = n;
    b.onclick = () => pickGuess(n, b);
    box.appendChild(b);
  });
  $("guessBox").hidden = false;
}
async function pickGuess(n, btn) {
  if (!ST || !ST.guessing) return;
  const { answer } = ST.opts.guess, right = n === answer;
  [...$("guessOpts").children].forEach(b => { b.disabled = true; if (b.textContent === answer) b.classList.add("right"); });
  if (!right) btn.classList.add("wrong");
  $("guessMsg").textContent = t(right ? "guessRight" : "guessWrong", { name: answer });
  if (right) { if (!reduceMotion) { confetti(); fxStart(); } fanfare(); }
  else { if (!reduceMotion) { sleet(); fxStart(); } sadFanfare(); }
  await sleep(reduceMotion ? 300 : right ? 1400 : 3000);   // låt den ledsna fanfaren spela klart
  if (!ST || !ST.guessing) return;
  ST.guessing = false; ST.guessed = true;
  $("guessBox").hidden = true;
  revealName();
  syncMoreBelow();
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
  syncMoreBelow();
}
$("keepBtn").onclick = () => decideStage(true);
$("dropBtn").onclick = () => decideStage(false);
$("againBtn").onclick = () => ST?.opts.again?.();
$("stageGallery").onclick = () => { if (ST?.opts.back) history.back(); else { leaveOnline(); openGallery(); } };
$("stageBack").onclick = () => history.back();

/* ---------- "Mer nedanför" ---------- */
// Resultatet (namnet, gissningen, spara eller radera, knapparna) hamnar ibland under skärmkanten.
// Då syns en knapp längst ned som rullar dit.
function syncMoreBelow() {
  const btn = $("moreBelow");
  if (currentScreen !== "s-stage" || $("postShow").hidden) { btn.hidden = true; return; }
  const last = [...$("postShow").children].filter(el => !el.hidden && el.offsetHeight).pop();
  btn.hidden = !last || last.getBoundingClientRect().bottom <= innerHeight - 8;
}
addEventListener("scroll", syncMoreBelow, { passive: true });
addEventListener("resize", syncMoreBelow);
$("moreBelow").onclick = () => {
  const p = $("postShow");
  scrollTo({ top: p.getBoundingClientRect().bottom + scrollY - innerHeight + 24, behavior: reduceMotion ? "auto" : "smooth" });
};
$("stageHome").onclick = () => { leaveOnline(); show("s-home"); };
