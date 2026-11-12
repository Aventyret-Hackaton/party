// Medan man väntar på sin tur dansar tre gubbar från galleriet på ett discogolv, i takt med
// partymusiken (122 slag per minut). Ovanför snurrar en discokula och färgade strålkastare sveper.
//
// Gubbarna har inget papper bakom sig, bara bläcket med ett ljust sken runt, så att mörkt bläck syns
// mot det mörka golvet. Varje del vickar för sig, som en marionett. Då och då dansar de i sidled,
// oregelbundet, och byter plats med varandra. Var tolfte sekund kommer nya dansare.

const WD = { box: null, timer: 0, move: 0 };
async function startDancers(id) {
  const box = $(id);
  if (WD.box === box) return;
  stopDancers();
  WD.box = box;
  if (!allGallery().length) { await apiReady; if (caps.api) await loadApiGallery(); }
  if (WD.box !== box) return;
  fillDancers(box);
  WD.timer = setInterval(() => {
    if (!box.offsetParent) { stopDancers(); return; }   // skärmen har bytts
    if (!document.hidden) fillDancers(box);
  }, 12000);
  moveDancers();
}
function stopDancers() {
  clearInterval(WD.timer); clearTimeout(WD.move);
  if (WD.box) WD.box.innerHTML = "";
  WD.box = null;
}
function fillDancers(box) {
  // Gubbarna i gruppbilderna får också dansa
  const list = allGallery().flatMap(r => isGroup(r) ? r.figs.map(f => ({ ...r, parts: f })) : [r])
    .filter(r => Array.isArray(r.parts) && r.parts.length > 1);
  box.innerHTML = "";
  if (!list.length) return;
  box.insertAdjacentHTML("beforeend", '<div class="disco-beam a"></div><div class="disco-beam b"></div><div class="disco-beam c"></div><div class="disco-dots"></div><div class="disco-ball"></div><div class="disco-floor"></div>');
  const scale = Math.min(2, Math.max(1, devicePixelRatio || 1)) * .3;
  shuffle([...list]).slice(0, 3).forEach((r, k) => {
    const dir = r.dir === "h" ? "h" : "v", n = r.parts.length;
    const spot = document.createElement("div"); spot.className = "dancer-spot";
    spot.style.left = (20 + k * 30) + "%";
    const d = document.createElement("figure"); d.className = "dancer";
    d.style.animationDelay = -(Math.random() * 1.9).toFixed(2) + "s";
    const fig = document.createElement("div"); fig.className = "mini " + dir;
    // Lika höga gubbar oavsett hur många delar de har: högst 10 rem
    if (dir === "v") fig.style.width = Math.min(5.5, 10 * 600 / (340 * n - 40 * (n - 1))).toFixed(2) + "rem";
    try {
      r.parts.forEach((p, i) => {
        const c = partCanvas(p.s, dir, scale, true);   // genomskinlig, inget papper
        c.style.animationDelay = (i % 2 ? -.49 : 0) + "s";
        fig.appendChild(c);
      });
    } catch (e) { return; }
    const nm = document.createElement("figcaption"); nm.textContent = r.name || t("nameless");
    d.append(fig, nm); spot.appendChild(d); box.appendChild(spot);
  });
}
// Dansarna glider till nya platser, oregelbundet. Ibland går de förbi varandra och byter plats.
function moveDancers() {
  clearTimeout(WD.move);
  if (!WD.box) return;
  if (!reduceMotion && !document.hidden) {
    const spots = [...WD.box.querySelectorAll(".dancer-spot")];
    // En eller två dansare flyttar sig åt gången, till en plats mellan 15 % och 85 % av golvet
    shuffle(spots).slice(0, 1 + Math.floor(Math.random() * 2)).forEach(s => {
      s.style.transitionDuration = (1.2 + Math.random() * 1.6).toFixed(2) + "s";
      s.style.left = (15 + Math.random() * 70).toFixed(1) + "%";
    });
  }
  WD.move = setTimeout(moveDancers, 900 + Math.random() * 2200);
}
