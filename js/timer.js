// Timern: hur lång tid den som ritar har på sig för sin del.
//
// Tiden ställs in när omgången skapas (30 s, 60 s, 90 s, 2 min eller ingen gräns, 60 s är förvalt).
// Den som ritar ser tiden i hörnet. När den har gått ut börjar det regna och en ledsam flöjt spelar,
// men man får rita klart i lugn och ro: timern visar då hur länge man har jobbat på övertid.
// Online ser de som väntar samma tid, och "Signe jobbar på övertid" när den har gått ut.
// Online börjar tiden när den som har tur öppnar ritytan (servern sparar när, se online-server.js).

const TM = { limit: 0, start: 0, timer: 0, over: false, rain: 0 };
// 75 000 ms → "1:15"
function clockText(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

/* ---------- Den som ritar ---------- */
function startDrawTimer(sec) {
  stopDrawTimer();
  TM.limit = sec; TM.start = Date.now(); TM.over = false;
  if (!sec) return;
  $("drawTimer").hidden = false;
  tickDraw();
  TM.timer = setInterval(tickDraw, 250);
}
function stopDrawTimer() {
  clearInterval(TM.timer); clearInterval(TM.rain); TM.timer = TM.rain = 0;
  const el = $("drawTimer"); el.hidden = true; el.classList.remove("low", "over");
}
function tickDraw() {
  if (currentScreen !== "s-draw") { stopDrawTimer(); return; }
  const left = TM.limit * 1000 - (Date.now() - TM.start), el = $("drawTimer");
  if (left > 0) {
    el.textContent = "⏱ " + clockText(left);
    el.classList.toggle("low", left <= 10000);
    el.setAttribute("aria-label", t("timeLeft", { t: clockText(left) }));
    return;
  }
  if (!TM.over) {
    // Tiden är ute: regn och en ledsam flöjt. Men man får fortsätta.
    TM.over = true;
    if (typeof sadFlute === "function") sadFlute();
    if (!reduceMotion) { sleet(); fxStart(); TM.rain = setInterval(() => { if (currentScreen === "s-draw") { rain(); fxStart(); } }, 1600); }
  }
  el.classList.remove("low"); el.classList.add("over");
  el.textContent = t("overtime", { t: clockText(-left) });
  el.setAttribute("aria-label", el.textContent);
}

/* ---------- De som väntar (online) ---------- */
function renderWaitTimer() {
  const g = ON?.game, el = $("waitTimer");
  const show = g && g.status === "drawing" && g.time && g.turnStart && currentScreen === "s-wait";
  el.hidden = !show;
  if (!show) return;
  const left = g.time * 1000 - (serverNow() - g.turnStart), who = nameOf(g.turns[g.current]);
  el.classList.toggle("over", left <= 0);
  el.textContent = left > 0 ? t("waitLeft", { name: who, t: clockText(left) }) : t("waitOvertime", { name: who, t: clockText(-left) });
}
setInterval(() => { if (currentScreen === "s-wait" && typeof ON !== "undefined" && ON) renderWaitTimer(); }, 500);
