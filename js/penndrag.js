// Penndrag som vektorer: rita, skala om och komprimera.

/* ---------- Penndrag ---------- */
function drawStroke(c, s) {
  const p = s.p;
  c.strokeStyle = c.fillStyle = s.e ? "#ffffff" : s.c;
  c.lineWidth = s.w; c.lineCap = "round"; c.lineJoin = "round";
  if (p.length <= 2) { c.beginPath(); c.arc(p[0], p[1], s.w / 2, 0, Math.PI * 2); c.fill(); return; }
  c.beginPath(); c.moveTo(p[0], p[1]);
  // mjuka kurvor genom mittpunkter
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
    c.quadraticCurveTo(p[i], p[i + 1], mx, my);
  }
  c.lineTo(p[p.length - 2], p[p.length - 1]);
  c.stroke();
}
function paint(c, strokes, W, H) {
  c.fillStyle = "#ffffff"; c.fillRect(0, 0, W, H);
  (strokes || []).forEach(s => drawStroke(c, s));
}
// Rita en del till en ny canvas i valfri skala
function partCanvas(strokes, dir, scale) {
  const { W, H } = DIMS[dir], c = document.createElement("canvas");
  c.width = Math.round(W * scale); c.height = Math.round(H * scale);
  const x = c.getContext("2d"); x.scale(scale, scale); paint(x, strokes, W, H);
  return c;
}
// Hela gubben i en bild
function figureCanvas(parts, dir, scale) {
  const { W, H } = DIMS[dir], n = parts.length, c = document.createElement("canvas");
  c.width = Math.round((dir === "v" ? W : W * n) * scale); c.height = Math.round((dir === "v" ? H * n : H) * scale);
  const x = c.getContext("2d");
  parts.forEach((s, i) => {
    x.save(); x.scale(scale, scale);
    if (dir === "v") x.translate(0, i * H); else x.translate(i * W, 0);
    x.beginPath(); x.rect(0, 0, W, H); x.clip(); paint(x, s, W, H); x.restore();
  });
  return c;
}
// Gör datan mindre innan den sparas
function compact(strokes, step = 1) {
  return strokes.map(s => {
    if (step === 1) return s;
    const p = [];
    for (let i = 0; i < s.p.length; i += 2 * step) p.push(s.p[i], s.p[i + 1]);
    if (p[p.length - 2] !== s.p[s.p.length - 2]) p.push(s.p[s.p.length - 2], s.p[s.p.length - 1]);
    return { ...s, p };
  });
}
function fitSize(obj, partsKey) {
  let step = 1, out = obj;
  while (JSON.stringify(out).length > 230000 && step < 8) {
    step++;
    out = { ...obj, [partsKey]: obj[partsKey].map(pt => ({ s: compact(pt.s, step) })) };
  }
  return out;
}
