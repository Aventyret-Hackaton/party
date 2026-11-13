// Gubben som tryckbar SVG, för Tryckskaparen (https://tryckskaparen.tifosi.se/#/teckning).
// Se docs/tryckskaparen-koppling.md.
//
// Krav från Tryckskaparen:
// - width, height och viewBox, och vit bakgrund
// - suddat ritas som vita streck
// - bara heldragna färger: ingen genomskinlighet, inga gradienter eller skuggor
//   (varje färg blir en tryckfärg)
//
// Gubben sätts ihop på samma sätt som figureCanvas i js/penndrag.js: delarna överlappar
// med remsan nedanför vikningen (GAP), och varje del klipps till sin egen ruta.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Samma mått som i spelet (js/kroppsdelar.js)
const { DIMS, GAP } = vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "js", "kroppsdelar.js"), "utf8") + "\n;({ DIMS, GAP })", {});

const num = n => String(Math.round(n * 10) / 10);
const colour = s => s.e ? "#ffffff" : (typeof s.c === "string" && /^#[0-9a-f]{6}$/i.test(s.c) ? s.c.toLowerCase() : "#222222");

// Ett penndrag. Mjuka kurvor genom mittpunkterna, precis som drawStroke i js/penndrag.js.
function strokeSvg(s) {
  const p = s.p, w = num(s.w), c = colour(s);
  if (!Array.isArray(p) || p.length < 2) return "";
  if (p.length <= 2) return `<circle cx="${num(p[0])}" cy="${num(p[1])}" r="${num(s.w / 2)}" fill="${c}"/>`;
  let d = `M${num(p[0])} ${num(p[1])}`;
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
    d += `Q${num(p[i])} ${num(p[i + 1])} ${num(mx)} ${num(my)}`;
  }
  d += `L${num(p[p.length - 2])} ${num(p[p.length - 1])}`;
  return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// En gubbe som SVG-bitar: storlek, klippytor och penndrag. ox, oy = var den står, k = skala, id = unikt prefix.
function figureParts(dir, parts, ox, oy, k, id) {
  const { W, H } = DIMS[dir], step = (dir === "v" ? H : W) - GAP, defs = [], body = [];
  parts.forEach((strokes, i) => {
    const x = dir === "v" ? 0 : i * step, y = dir === "v" ? i * step : 0;
    defs.push(`<clipPath id="${id}d${i}"><rect x="${x}" y="${y}" width="${W}" height="${H}"/></clipPath>`);
    body.push(`<g clip-path="url(#${id}d${i})"><g transform="translate(${x} ${y})">`);
    strokes.forEach(st => body.push(strokeSvg(st)));
    body.push("</g></g>");
  });
  return { defs, body: [`<g transform="translate(${num(ox)} ${num(oy)}) scale(${k})">`, ...body, "</g>"] };
}
const figSize = (dir, n) => { const { W, H } = DIMS[dir], step = (dir === "v" ? H : W) - GAP; return dir === "v" ? [W, H + step * (n - 1)] : [W + step * (n - 1), H]; };

// Gruppbilden från power-läget: gubbarna fördelas jämnt på en stående tryckyta (3:4, som ett tröjtryck).
// Vi provar alla antal rader och väljer det som fyller ytan bäst. Alla gubbar blir lika höga,
// raderna centreras och det är lika mycket luft mellan dem.
const AREA = { w: 3000, h: 4000 }, PAD = 60;
function groupSvg(rec) {
  const dir = rec.dir === "h" ? "h" : "v";
  const figs = (rec.figs || []).map(f => (f || []).map(pt => (pt && Array.isArray(pt.s)) ? pt.s : []));
  const sizes = figs.map(f => figSize(dir, Math.max(1, f.length))), n = figs.length;
  let best = null;
  for (let rows = 1; rows <= n; rows++) {
    const per = Math.ceil(n / rows), lines = [];
    for (let i = 0; i < n; i += per) lines.push(sizes.slice(i, i + per).map((s, j) => ({ s, i: i + j })));
    // Höjden på varje gubbe (i ritytans mått) blir 1, bredden s[0]/s[1]. Räkna fram skalan som får allt att få plats.
    const lineW = lines.map(l => l.reduce((a, x) => a + x.s[0] / x.s[1], 0));
    const k = Math.min((AREA.w - PAD * (per + 1)) / Math.max(...lineW), (AREA.h - PAD * (lines.length + 1)) / lines.length);
    const used = k * k * sizes.reduce((a, s) => a + s[0] / s[1], 0);
    if (!best || used > best.used) best = { used, k, lines, lineW };
  }
  const { k, lines, lineW } = best, gapY = (AREA.h - k * lines.length) / (lines.length + 1);
  const defs = [], body = [];
  lines.forEach((l, r) => {
    const gapX = (AREA.w - k * lineW[r]) / (l.length + 1);
    let x = gapX;
    l.forEach(({ s, i }) => {
      const scale = Math.round(k / s[1] * 1000) / 1000;
      const part = figureParts(dir, figs[i], x, gapY + r * (k + gapY), scale, "g" + i);
      defs.push(...part.defs); body.push(...part.body);
      x += s[0] * scale + gapX;
    });
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${AREA.w}" height="${AREA.h}" viewBox="0 0 ${AREA.w} ${AREA.h}">`,
    `<rect width="${AREA.w}" height="${AREA.h}" fill="#ffffff"/>`,
    "<defs>", ...defs, "</defs>", ...body, "</svg>"
  ].join("\n");
}

// rec = en gubbe ur galleriet: { dir: "v" | "h", parts: [{ s: [penndrag] }, ...] }, eller en gruppbild med figs
function figureSvg(rec) {
  if (rec.kind === "group") return groupSvg(rec);
  const dir = rec.dir === "h" ? "h" : "v", { W, H } = DIMS[dir];
  const parts = (rec.parts || []).map(pt => (pt && Array.isArray(pt.s)) ? pt.s : []);
  const n = Math.max(1, parts.length), step = (dir === "v" ? H : W) - GAP;
  const totalW = dir === "v" ? W : W + step * (n - 1), totalH = dir === "v" ? H + step * (n - 1) : H;
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">`,
    `<rect width="${totalW}" height="${totalH}" fill="#ffffff"/>`,
    "<defs>"
  ];
  parts.forEach((_, i) => {
    const x = dir === "v" ? 0 : i * step, y = dir === "v" ? i * step : 0;
    out.push(`<clipPath id="del${i}"><rect x="${x}" y="${y}" width="${W}" height="${H}"/></clipPath>`);
  });
  out.push("</defs>");
  parts.forEach((strokes, i) => {
    const x = dir === "v" ? 0 : i * step, y = dir === "v" ? i * step : 0;
    out.push(`<g clip-path="url(#del${i})"><g transform="translate(${x} ${y})">`);
    strokes.forEach(s => out.push(strokeSvg(s)));
    out.push("</g></g>");
  });
  out.push("</svg>");
  return out.join("\n");
}

module.exports = { figureSvg };
