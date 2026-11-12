// Penndrag som vektorer: rita, skala om och komprimera.

/* ---------- Penndrag ---------- */
// clear = genomskinlig bakgrund (på scenen). Då tar suddet bort bläck i stället för att måla vitt.
function drawStroke(c, s, clear = false) {
  const p = s.p;
  c.save();
  if (s.e && clear) c.globalCompositeOperation = "destination-out";
  c.strokeStyle = c.fillStyle = s.e ? "#ffffff" : s.c;
  c.lineWidth = s.w; c.lineCap = "round"; c.lineJoin = "round";
  if (p.length <= 2) { c.beginPath(); c.arc(p[0], p[1], s.w / 2, 0, Math.PI * 2); c.fill(); c.restore(); return; }
  c.beginPath(); c.moveTo(p[0], p[1]);
  // mjuka kurvor genom mittpunkter
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
    c.quadraticCurveTo(p[i], p[i + 1], mx, my);
  }
  c.lineTo(p[p.length - 2], p[p.length - 1]);
  c.stroke();
  c.restore();
}
function paint(c, strokes, W, H, clear = false) {
  if (clear) c.clearRect(0, 0, W, H);
  else { c.fillStyle = "#ffffff"; c.fillRect(0, 0, W, H); }
  (strokes || []).forEach(s => drawStroke(c, s, clear));
}
// Rita en del till en ny canvas i valfri skala
function partCanvas(strokes, dir, scale, clear = false) {
  const { W, H } = DIMS[dir], c = document.createElement("canvas");
  c.width = Math.round(W * scale); c.height = Math.round(H * scale);
  const x = c.getContext("2d"); x.scale(scale, scale); paint(x, strokes, W, H, clear);
  return c;
}
// Hur ljust är bläcket i snitt (0 = svart, 1 = vitt)? Långa, tjocka drag väger mest.
function inkLightness(parts) {
  const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  let sum = 0, weight = 0;
  for (const strokes of parts) for (const s of strokes || []) {
    if (s.e || !/^#[0-9a-f]{6}$/i.test(s.c || "")) continue;
    const n = parseInt(s.c.slice(1), 16);
    const L = .2126 * lin(n >> 16) + .7152 * lin((n >> 8) & 255) + .0722 * lin(n & 255);
    const w = s.w * Math.max(1, s.p.length / 2);
    sum += L * w; weight += w;
  }
  return weight ? sum / weight : 0;
}
// Hela gubben i en bild. Delarna överlappar med remsan nedanför vikningen (GAP), som på papper.
function figureCanvas(parts, dir, scale, clear = false) {
  const { W, H } = DIMS[dir], n = parts.length, step = (dir === "v" ? H : W) - GAP, c = document.createElement("canvas");
  c.width = Math.round((dir === "v" ? W : W + step * (n - 1)) * scale);
  c.height = Math.round((dir === "v" ? H + step * (n - 1) : H) * scale);
  const x = c.getContext("2d");
  x.scale(scale, scale);
  if (!clear) { x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width / scale, c.height / scale); }
  parts.forEach((s, i) => {
    x.save();
    if (dir === "v") x.translate(0, i * step); else x.translate(i * step, 0);
    x.beginPath(); x.rect(0, 0, W, H); x.clip();
    (s || []).forEach(st => drawStroke(x, st, clear));
    x.restore();
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
// Gruppbilden: alla gubbar ihop får vara högst cirka 900 kB
function fitGroup(rec) {
  let step = 1, out = rec;
  while (JSON.stringify(out).length > 900000 && step < 8) {
    step++;
    out = { ...rec, figs: rec.figs.map(f => f.map(pt => ({ s: compact(pt.s, step) }))) };
  }
  return out;
}
// Gruppbilden som en bild: gubbarna bredvid varandra, lika höga (height i punkter), utan papper bakom
function groupCanvas(figs, dir, height, scale, clear = true) {
  const { W, H } = DIMS[dir], gap = height * .08;
  const size = n => { const step = (dir === "v" ? H : W) - GAP; return dir === "v" ? [W, H + step * (n - 1)] : [W + step * (n - 1), H]; };
  const ks = figs.map(f => height / size(f.length)[1]);
  const width = figs.reduce((a, f, i) => a + size(f.length)[0] * ks[i], 0) + gap * (figs.length - 1);
  const c = document.createElement("canvas");
  c.width = Math.round(width * scale); c.height = Math.round(height * scale);
  const x = c.getContext("2d"); x.scale(scale, scale);
  if (!clear) { x.fillStyle = "#ffffff"; x.fillRect(0, 0, width, height); }
  let left = 0;
  figs.forEach((f, i) => {
    const one = figureCanvas(f.map(p => p.s || p), dir, Math.max(1, ks[i] * scale), true);
    x.drawImage(one, left, 0, size(f.length)[0] * ks[i], height);
    left += size(f.length)[0] * ks[i] + gap;
  });
  return c;
}
function fitSize(obj, partsKey) {
  let step = 1, out = obj;
  while (JSON.stringify(out).length > 230000 && step < 8) {
    step++;
    out = { ...obj, [partsKey]: obj[partsKey].map(pt => ({ s: compact(pt.s, step) })) };
  }
  return out;
}
