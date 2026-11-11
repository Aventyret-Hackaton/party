// AI:n hittar på ett namn utifrån teckningen.

/* ---------- AI-namn utifrån en snabbtolkning av teckningen ---------- */
const SYL = ["bo","ka","zi","lu","mo","fi","ra","pe","nu","gu","ti","ve","so","dra","plu","snu","kri","mi"];
function fallbackName(staff) {
  const n = 2 + Math.floor(Math.random() * 2); let s = "";
  for (let i = 0; i < n; i++) s += SYL[Math.floor(Math.random() * SYL.length)];
  s = s[0].toUpperCase() + s.slice(1);
  return { name: staff ? `${staff} ${t("as_")} ${s}` : s, what: "" };
}
async function aiName(rec) {
  if (!caps.sample) return fallbackName(rec.staff);
  try {
    const big = figureCanvas(rec.parts, rec.dir, 1);
    const k = Math.min(1, 700 / Math.max(big.width, big.height));
    const small = document.createElement("canvas"); small.width = Math.round(big.width * k); small.height = Math.round(big.height * k);
    small.getContext("2d").drawImage(big, 0, 0, small.width, small.height);
    const blob = await new Promise(r => small.toBlob(r, "image/png"));
    const L = LANG_EN[lang];
    let prompt = `This is a drawing from the folding drawing game "exquisite corpse": several people each drew one part without seeing the others (${rec.dir === "v" ? "top to bottom" : "left to right"}). Quickly interpret what the whole figure looks like. Then invent a playful, family-friendly name for it, at most five words, in ${L}. Reply ONLY with JSON: {"what": "<1-4 words in ${L} for what it most looks like>", "name": "<the name>"}.`;
    if (rec.staff) prompt += ` The head was drawn from memory as a person called ${rec.staff}. The name must follow the pattern "${rec.staff} ${t("as_")} <what it looks like>" written naturally in ${L}, for example in Swedish "${rec.staff} som häst".`;
    const r = await caps.sample.json(prompt, { images: [blob], modelTier: "quick" });
    if (r && typeof r.name === "string" && r.name.trim()) return { name: r.name.trim().slice(0, 80), what: String(r.what || "").slice(0, 60) };
  } catch (e) { console.warn("Namngivning misslyckades", e); }
  return fallbackName(rec.staff);
}
