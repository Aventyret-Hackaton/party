// Ritskärmen: canvasen man ritar på, palett, tjocklek, sudd och ångra.

/* ---------- Ritskärmen ---------- */
const pad = $("pad"), pctx = pad.getContext("2d");
const PALETTE = ["#222222","#e2481e","#c19c61","#8a6a35","#1f6fd1","#5bc0de","#2e9e4f","#f2c12e","#e85d9c","#8e44ad","#7a4b2a","#9aa0a6"];
const toolMem = {};
const D = { dir: "v", strokes: [], prev: null, cur: null, color: "#222222", size: 5, erase: false, who: "", onDone: null, meta: null };

function openDraw(meta) {
  // meta: {dir, i, n, who, whoKey, prev, online, onDone}
  Object.assign(D, { dir: meta.dir, strokes: [], prev: meta.prev, cur: null, erase: false, meta, onDone: meta.onDone });
  const mem = toolMem[meta.whoKey] || { color: "#222222", size: 5 };
  D.color = mem.color; D.size = mem.size;
  const { W, H } = DIMS[D.dir];
  pad.width = W; pad.height = H;
  $("sheet").className = "sheet paperclip " + D.dir;
  $("hintLabel").hidden = !D.prev;
  $("foldline").hidden = meta.i === meta.n - 1;
  buildPalette(); syncTools();
  renderDrawTexts();
  show("s-draw");
  requestAnimationFrame(() => requestAnimationFrame(fitPad));
}
function renderDrawTexts() {
  const m = D.meta; if (!m) return;
  $("partTitle").textContent = t(m.key || partKey(m.dir, m.n, m.i));
  $("partCount").textContent = t("partOf", { i: m.i + 1, n: m.n });
  $("whoDraws").textContent = m.who;
  $("guide").textContent = m.i === m.n - 1 ? t("guideLast") : t(m.dir === "v" ? "guideV" : "guideH");
  $("hintLabel").textContent = t("hintLabel");
  $("foldBtn").textContent = m.i === m.n - 1 ? t("finish") : t(m.online ? "foldOnline" : "fold");
  pad.setAttribute("aria-label", t("canvasLabel"));
}
function fitPad() {
  const r = pad.getBoundingClientRect(); if (!r.width) return;
  const d = devicePixelRatio || 1;
  pad.width = Math.round(r.width * d); pad.height = Math.round(r.height * d);
  redraw();
}
function redraw() {
  const { W, H } = DIMS[D.dir], k = pad.width / W;
  pctx.setTransform(k, 0, 0, k, 0, 0);
  pctx.fillStyle = "#ffffff"; pctx.fillRect(0, 0, W, H);
  // Som på papper: det förra delen ritade nedanför vikningen ligger överst (eller längst till vänster)
  // på den här delen, på exakt samma ställe som i den färdiga gubben.
  if (D.prev) {
    pctx.save(); pctx.beginPath();
    if (D.dir === "v") { pctx.rect(0, 0, W, GAP); pctx.clip(); pctx.translate(0, -(H - GAP)); }
    else { pctx.rect(0, 0, GAP, H); pctx.clip(); pctx.translate(-(W - GAP), 0); }
    D.prev.forEach(s => drawStroke(pctx, s));
    pctx.restore();
  }
  D.strokes.forEach(s => drawStroke(pctx, s));
}
function toLogical(e) {
  const r = pad.getBoundingClientRect(), { W, H } = DIMS[D.dir];
  return [Math.round((e.clientX - r.left) / r.width * W * 10) / 10, Math.round((e.clientY - r.top) / r.height * H * 10) / 10];
}
// Ett finger ritar. Två fingrar zoomar (touch-action: pinch-zoom i CSS) och ritar aldrig:
// strecket som första fingret hann börja tas bort, och inget ritas förrän alla fingrar har lyfts.
const fingers = new Set();
let pinching = false, curId = null;
function dropStroke() {
  if (!D.cur) return;
  const i = D.strokes.lastIndexOf(D.cur);
  if (i >= 0) D.strokes.splice(i, 1);
  D.cur = null; curId = null; redraw();
}
pad.addEventListener("pointerdown", e => {
  fingers.add(e.pointerId);
  if (fingers.size > 1) { pinching = true; dropStroke(); return; }
  if (pinching) return;
  e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch (err) {}
  const [x, y] = toLogical(e);
  curId = e.pointerId;
  D.cur = { c: D.color, w: D.erase ? D.size * 2 : D.size, e: D.erase ? 1 : 0, p: [x, y] };
  D.strokes.push(D.cur); drawStroke(pctx, D.cur);
});
pad.addEventListener("pointermove", e => {
  if (!D.cur || e.pointerId !== curId) return;
  const [x, y] = toLogical(e), p = D.cur.p, lx = p[p.length - 2], ly = p[p.length - 1];
  if (Math.hypot(x - lx, y - ly) < 1.2) return;
  p.push(x, y);
  pctx.strokeStyle = D.cur.e ? "#ffffff" : D.cur.c; pctx.lineWidth = D.cur.w; pctx.lineCap = "round";
  pctx.beginPath(); pctx.moveTo(lx, ly); pctx.lineTo(x, y); pctx.stroke();
});
// pointercancel betyder att webbläsaren tog över, till exempel för att zooma. Då ska strecket inte bli kvar.
pad.addEventListener("pointercancel", e => { fingers.delete(e.pointerId); if (e.pointerId === curId) dropStroke(); if (!fingers.size) pinching = false; });
pad.addEventListener("pointerup", e => {
  fingers.delete(e.pointerId);
  if (!fingers.size) pinching = false;
  if (D.cur && e.pointerId === curId) { D.cur = null; curId = null; redraw(); }
});
addEventListener("resize", () => { if ($("s-draw").classList.contains("active")) fitPad(); });

function buildPalette() {
  const box = $("palette"); box.innerHTML = ""; box.setAttribute("aria-label", t("custom"));
  PALETTE.forEach(c => {
    const b = document.createElement("button"); b.className = "sw"; b.style.background = c; b.dataset.c = c;
    b.setAttribute("aria-label", c);
    b.onclick = () => { D.color = c; D.erase = false; syncTools(); };
    box.appendChild(b);
  });
  const w = document.createElement("label"); w.className = "customc"; w.title = t("custom");
  w.innerHTML = `<span class="sr">${t("custom")}</span><input type="color" value="#e2481e">`;
  w.querySelector("input").oninput = e => { D.color = e.target.value; D.erase = false; syncTools(); };
  box.appendChild(w);
}
function syncTools() {
  $("palette").querySelectorAll(".sw").forEach(b => b.setAttribute("aria-pressed", !D.erase && b.dataset.c === D.color));
  $("eraser").setAttribute("aria-pressed", D.erase);
  $("sizeRange").value = D.size;
  const dot = $("sizeDot"), s = Math.max(2, Math.min(44, D.size));
  dot.style.width = dot.style.height = s + "px"; dot.style.background = D.erase ? "#ccc" : D.color;
  if (D.meta) toolMem[D.meta.whoKey] = { color: D.color, size: D.size };
}
$("sizeRange").oninput = e => { D.size = +e.target.value; syncTools(); };
$("eraser").onclick = () => { D.erase = !D.erase; syncTools(); };
$("undo").onclick = () => { D.strokes.pop(); redraw(); };
$("clear").onclick = () => { if (D.strokes.length && confirm(t("clearConfirm"))) { D.strokes = []; redraw(); } };
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && $("s-draw").classList.contains("active")) { e.preventDefault(); D.strokes.pop(); redraw(); }
});
$("foldBtn").onclick = () => {
  if (!D.strokes.length && !confirm(t("emptyConfirm"))) return;
  const s = D.strokes; D.meta = null; D.onDone(s);
};
