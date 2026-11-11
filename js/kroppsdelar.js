// Vilka delar som ritas, beroende på riktning och antal.

/* ---------- Kroppsdelar ---------- */
const PARTSETS = {
  v: { 3:["head","body","legsfeet"], 4:["head","body","legs","feet"], 5:["hat","head","body","legs","feet"], 6:["hat","head","body","legs","feet","ground"] },
  h: { 3:["headfront","middle","rearTail"], 4:["head","front","rear","tail"], 5:["snout","head","front","rear","tail"], 6:["snout","head","front","middle","rear","tail"] }
};
const partKey = (dir, n, i) => PARTSETS[dir][n][i];
// Riktning och alla delar i ordning, till exempel "Gubben ritas uppifrån och ned, i 3 delar: 1 huvud, 2 överkropp, 3 ben och fötter."
function partsInfo(dir, n) {
  const parts = PARTSETS[dir][n].map((k, i) => `${i + 1} ${lc(t(k))}`).join(", ");
  return t(dir === "v" ? "partsV" : "partsH", { n, parts });
}
const headIndex = (dir, n) => PARTSETS[dir][n].findIndex(k => k === "head" || k === "headfront");
const DIMS = { v: { W: 600, H: 340 }, h: { W: 340, H: 600 } };
const GAP = 40; // så mycket som syns av förra delen
