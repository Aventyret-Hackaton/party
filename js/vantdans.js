// Medan man väntar på sin tur dansar tre gubbar från galleriet, i takt med partymusiken (122 slag per minut).
// Var nionde sekund kommer nya dansare. Varje del av gubben vickar för sig, som en marionett.

const WD = { box: null, timer: 0 };
async function startDancers(id) {
  const box = $(id);
  if (WD.box === box) return;
  WD.box = box; clearInterval(WD.timer);
  if (!allGallery().length) { await apiReady; if (caps.api) await loadApiGallery(); }
  if (WD.box !== box) return;
  fillDancers(box);
  WD.timer = setInterval(() => {
    if (!box.offsetParent) { clearInterval(WD.timer); WD.box = null; box.innerHTML = ""; return; }   // skärmen har bytts
    if (!document.hidden) fillDancers(box);
  }, 9000);
}
function fillDancers(box) {
  const list = allGallery().filter(r => Array.isArray(r.parts) && r.parts.length > 1);
  box.innerHTML = "";
  const scale = Math.min(2, Math.max(1, devicePixelRatio || 1)) * .3;
  for (const r of shuffle([...list]).slice(0, 3)) {
    const d = document.createElement("figure"); d.className = "dancer";
    d.style.animationDelay = -(Math.random() * 1.9).toFixed(2) + "s";
    const fig = document.createElement("div"); fig.className = "mini " + (r.dir === "h" ? "h" : "v");
    try {
      r.parts.forEach((p, i) => {
        const c = partCanvas(p.s, r.dir === "h" ? "h" : "v", scale);
        c.style.animationDelay = (i % 2 ? -.49 : 0) + "s";
        fig.appendChild(c);
      });
    } catch (e) { continue; }
    const nm = document.createElement("figcaption"); nm.textContent = r.name || t("nameless");
    d.append(fig, nm);
    box.appendChild(d);
  }
}
