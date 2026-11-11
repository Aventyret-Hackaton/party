// Databas, inloggning, AI och bilduppladdning via claude.ai. Ska ersättas, se docs/krav.md.

/* ---------- Plattformsfunktioner (databas, AI, inloggning) ---------- */
const caps = { db: null, user: null, sample: null, assets: null, uid: null, canEdit: false, canWrite: false };
let faces = [];
(async () => {
  if (!window.claude || !window.claude.use) return;
  const [db, user, sample, assets] = await Promise.all(["db", "user", "sample", "assets"].map(n => window.claude.use(n).catch(() => null)));
  Object.assign(caps, { db, user, sample, assets });
  if (user) {
    try { caps.uid = await user.id(); } catch (e) {}
    try { caps.canEdit = await user.canEdit(); } catch (e) {}
    try { const w = await user.can("data.write"); caps.canWrite = w !== false; } catch (e) { caps.canWrite = true; }
  }
  if (db) {
    db.collection("faces").onSnapshot(s => {
      faces = s.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFaces(); renderSetupChips();
    }, () => {});
  }
  $("goFaces").hidden = !caps.canEdit;
})();
