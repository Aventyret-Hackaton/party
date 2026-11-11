// Databas, inloggning, AI och bilduppladdning via claude.ai. Ska ersättas, se docs/krav.md.

/* ---------- Plattformsfunktioner (databas, AI, inloggning) ---------- */
const caps = { db: null, user: null, sample: null, assets: null, uid: null, canEdit: false, canWrite: false, api: false };
let faces = [];
const faceSrc = f => f.src || "/_blob/" + f.asset;

// Egen server (Heroku): det gemensamma galleriet. Se server.js.
const apiReady = fetch("/api/health", { cache: "no-store" })
  .then(r => { caps.version = r.headers.get("X-App-Version") || ""; return r.ok ? r.json() : null; })
  .then(j => { caps.api = !!(j && j.ok); caps.onlinePw = !!(j && j.password); caps.pushKey = (j && j.pushKey) || ""; })
  .catch(() => {});

// Ansikten från mappen assets/ansikten, listade i ansikten.json. Se README.md i den mappen.
fetch("assets/ansikten/ansikten.json", { cache: "no-cache" })
  .then(r => r.ok ? r.json() : [])
  .then(list => {
    if (faces.length || !Array.isArray(list)) return;
    faces = list.filter(f => f && f.namn && f.fil).map((f, i) => ({ id: "fil" + i, name: f.namn, src: "assets/ansikten/" + f.fil }));
    if (faces.length) { renderFaces(); renderSetupChips(); }
  })
  .catch(() => {});

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
