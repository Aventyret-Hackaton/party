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

// rec = en gubbe ur galleriet: { dir: "v" | "h", parts: [{ s: [penndrag] }, ...] }
function figureSvg(rec) {
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
