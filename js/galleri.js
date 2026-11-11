// Galleriet med filter på världsdel, land och stad.

/* ---------- Galleri ---------- */
let gallery = [], localGallery = [], galSub = null;
async function saveGallery(rec) {
  if (caps.db && caps.canWrite) {
    try { const ref = await caps.db.collection("gallery").add(fitSize(rec, "parts")); return ref.id; }
    catch (e) { console.warn(e); }
  }
  localGallery.unshift({ id: "local" + Date.now(), ...rec });
  return null;
}
async function renameGallery(id, name) {
  if (!id) return;
  if (id.startsWith("local")) { const r = localGallery.find(x => x.id === id); if (r) r.name = name; return; }
  try { await caps.db.doc("gallery/" + id).update({ name }); } catch (e) { console.warn(e); }
}
function openGallery() {
  $("galNote").textContent = caps.db ? "" : t("galLocal");
  if (caps.db && !galSub) {
    galSub = caps.db.collection("gallery").orderBy("createdAt", "desc").limit(120).onSnapshot(s => {
      gallery = s.docs.map(d => ({ id: d.id, ...d.data() }));
      if (currentScreen === "s-gallery") renderGallery();
    }, () => {});
  }
  renderGallery(); show("s-gallery");
}
function allGallery() { return [...localGallery, ...gallery]; }
function renderGallery() {
  const items = allGallery(), fc = $("fCont"), fco = $("fCountry"), fci = $("fCity");
  const keep = { c: fc.value, co: fco.value, ci: fci.value };
  const withCity = items.map(r => ({ r, c: findCity(r.home) })).filter(x => x.c);
  const fill = (sel, vals, label, cur) => {
    sel.innerHTML = `<option value="">${t("all")}</option>` + vals.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
    sel.value = vals.some(([v]) => v === cur) ? cur : "";
  };
  fill(fc, CONTS.filter(ct => withCity.some(x => x.c[2] === ct)).map(ct => [ct, t(ct)]), "", keep.c);
  const inCont = withCity.filter(x => !fc.value || x.c[2] === fc.value);
  const countries = [...new Set(inCont.map(x => x.c[1]))].map(cc => [cc, countryName(cc)]).sort((a, b) => a[1].localeCompare(b[1]));
  fill(fco, countries, "", keep.co);
  const inCountry = inCont.filter(x => !fco.value || x.c[1] === fco.value);
  const cities = [...new Set(inCountry.map(x => cityKey(x.c)))].map(k => [k, k.split("|")[0]]).sort((a, b) => a[1].localeCompare(b[1]));
  fill(fci, cities, "", keep.ci);
  const shown = inCountry.filter(x => !fci.value || cityKey(x.c) === fci.value).map(x => x.r);
  const grid = $("galGrid"); grid.innerHTML = "";
  if (!shown.length) { grid.innerHTML = `<p class="fine">${t("galEmpty")}</p>`; return; }
  shown.forEach(r => {
    const b = document.createElement("button"); b.className = "card";
    const th = document.createElement("div"); th.className = "thumb";
    try {
      const parts = r.parts.map(p => p.s), c = figureCanvas(parts, r.dir, 0.4);
      th.appendChild(c);
    } catch (e) {}
    const nm = document.createElement("b"); nm.textContent = r.name || t("nameless");
    const pl = document.createElement("span"); pl.textContent = placeLabel(r.home);
    b.append(th, nm, pl);
    b.onclick = () => openGalleryItem(r);
    grid.appendChild(b);
  });
}
["fCont", "fCountry", "fCity"].forEach(id => $(id).onchange = renderGallery);
async function byLabel(r) {
  if (r.names) return r.names.join(", ");
  if (r.uids && caps.user) {
    try { const ps = await caps.user.profiles(r.uids); return r.uids.map((u, i) => ps[u]?.name || t("player", { n: i + 1 })).join(", "); } catch (e) {}
  }
  return "";
}
async function openGalleryItem(r) {
  const rec = { parts: r.parts.map(p => p.s), dir: r.dir, home: r.home, by: await byLabel(r), name: r.name, staff: r.staff, mid: r.mode === "online" };
  openStage(rec, { canUnfold: true, replay: true, onRename: n => { r.name = n; return renameGallery(r.id, n); } });
}
$("goGallery").onclick = openGallery;
