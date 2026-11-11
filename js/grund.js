// Gemensamma hjälpfunktioner: valt språk, t() för översättning, $() för element.

let lang = (() => {
  try { const s = localStorage.getItem("vg-lang"); if (s && T[s]) return s; } catch (e) {}
  const n = (navigator.language || "sv").slice(0, 2);
  return T[n] ? n : "sv";
})();
let soundOn = (() => { try { return localStorage.getItem("vg-sound") !== "off"; } catch (e) { return true; } })();

function t(k, v = {}) {
  let s = (T[lang][k] ?? T.en[k] ?? k);
  for (const x in v) s = s.split("{" + x + "}").join(v[x]);
  return s;
}
const $ = id => document.getElementById(id);
const lc = s => lang === "de" ? s : s.toLowerCase();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
