// Galleriet med filter på världsdel, land och stad.

/* ---------- Galleri ---------- */
let gallery = [], localGallery = [], galSub = null, galPoll = null, galView = "grid";

// Nycklar för att få byta namn på gubbar man själv har sparat på servern
const myKeys = (() => { try { return JSON.parse(localStorage.getItem("party-keys") || "{}"); } catch (e) { return {}; } })();
function rememberKey(id, token) { myKeys[id] = token; try { localStorage.setItem("party-keys", JSON.stringify(myKeys)); } catch (e) {} }
const apiId = id => typeof id === "string" && id.startsWith("api:") ? id.slice(4) : null;

async function saveGallery(rec) {
  await apiReady;
  if (caps.api) {
    try {
      const r = await fetch("/api/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fitSize(rec, "parts")) });
      if (r.ok) {
        const { id, token } = await r.json();
        rememberKey(id, token);
        gallery.unshift({ ...rec, id: "api:" + id });
        return "api:" + id;
      }
      console.warn("Galleriet svarade", r.status);
    } catch (e) { console.warn(e); }
  } else if (caps.db && caps.canWrite) {
    try { const ref = await caps.db.collection("gallery").add(fitSize(rec, "parts")); return ref.id; }
    catch (e) { console.warn(e); }
  }
  localGallery.unshift({ id: "local" + Date.now(), ...rec });
  return null;
}
const canRename = r => !apiId(r.id) || !!myKeys[apiId(r.id)];
async function renameGallery(id, name) {
  if (!id) return;
  if (id.startsWith("local")) { const r = localGallery.find(x => x.id === id); if (r) r.name = name; return; }
  const a = apiId(id);
  if (a) {
    try { await fetch("/api/gallery/" + a, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, token: myKeys[a] }) }); }
    catch (e) { console.warn(e); }
    return;
  }
  try { await caps.db.doc("gallery/" + id).update({ name }); } catch (e) { console.warn(e); }
}
async function loadApiGallery() {
  try {
    const r = await fetch("/api/gallery", { cache: "no-store" });
    if (!r.ok) return;
    gallery = (await r.json()).map(g => ({ ...g, id: "api:" + g.id }));
    if (currentScreen === "s-gallery") renderGallery();
  } catch (e) { console.warn(e); }
}
async function openGallery() {
  await apiReady;
  $("galNote").textContent = caps.api ? t("galShared") : caps.db ? "" : t("galLocal");
  if (caps.api) {
    loadApiGallery();
    // Hämta nya gubbar då och då medan galleriet är öppet
    clearInterval(galPoll);
    galPoll = setInterval(() => {
      if (currentScreen !== "s-gallery") clearInterval(galPoll);
      else if (!document.hidden) loadApiGallery();
    }, 20000);
  } else if (caps.db && !galSub) {
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
  renderViewChips();
  const grid = $("galGrid"); grid.innerHTML = "";
  $("galMap").hidden = galView !== "map";
  grid.hidden = galView === "map" && shown.length > 0;
  if (!shown.length) grid.innerHTML = `<p class="fine">${t("galEmpty")}</p>`;
  if (galView === "map") { renderMap(shown, [fc.value, fco.value, fci.value].join("/")); return; }
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

/* ---------- Rutnät eller karta ---------- */
function renderViewChips() {
  const box = $("galView"); box.innerHTML = "";
  [["grid", t("gridView")], ["map", t("mapView")]].forEach(([v, label]) => {
    const b = document.createElement("button"); b.className = "chip"; b.textContent = label;
    b.setAttribute("aria-pressed", galView === v);
    b.onclick = () => { galView = v; renderGallery(); };
    box.appendChild(b);
  });
}

/* ---------- Kartvyn: gubbarna i staden där de bor ---------- */
// Leaflet (kartbiblioteket) och kartbilderna från OpenStreetMap laddas först när kartan öppnas.
let leafletP = null, galMap = null, galLayer = null, lastFit = "";
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  leafletP ||= new Promise((resolve, reject) => {
    const css = document.createElement("link"); css.rel = "stylesheet";
    css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    const js = document.createElement("script");
    js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    js.onload = resolve; js.onerror = reject;
    document.head.append(css, js);
  });
  return leafletP;
}
async function renderMap(items, filterKey) {
  const box = $("galMap");
  try { await loadLeaflet(); }
  catch (e) { leafletP = null; box.innerHTML = `<p class="fine">${t("mapFail")}</p>`; return; }
  if (galView !== "map" || currentScreen !== "s-gallery") return;
  if (!galMap) {
    galMap = L.map(box, { worldCopyJump: true, zoomSnap: 0.5 }).setView([30, 10], 2);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(galMap);
    galLayer = L.layerGroup().addTo(galMap);
  }
  galMap.invalidateSize();
  galLayer.clearLayers();
  const byCity = new Map();
  for (const r of items) { if (!byCity.has(r.home)) byCity.set(r.home, []); byCity.get(r.home).push(r); }
  const points = [];
  for (const [key, list] of byCity) {
    const c = findCity(key); if (!c) continue;
    points.push([c[3], c[4]]);
    const icon = L.divIcon({ className: "pin", html: `<span>${list.length}</span>`, iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -16] });
    L.marker([c[3], c[4]], { icon, title: placeLabel(key), keyboard: true })
      .bindPopup(() => cityPopup(key, list), { maxWidth: 300, minWidth: 200 })
      .addTo(galLayer);
  }
  // Zooma bara om när filtret ändras, inte varje gång nya gubbar hämtas
  const fit = filterKey + "|" + byCity.size;
  if (fit !== lastFit && points.length) {
    lastFit = fit;
    if (points.length === 1) galMap.setView(points[0], 6);
    else galMap.fitBounds(points, { padding: [40, 40], maxZoom: 6 });
  }
}
function cityPopup(key, list) {
  const box = document.createElement("div"); box.className = "mappop";
  const h = document.createElement("h3"); h.textContent = placeLabel(key);
  const n = document.createElement("p"); n.className = "fine"; n.textContent = t(list.length === 1 ? "figCount1" : "figCount", { n: list.length });
  const grid = document.createElement("div"); grid.className = "mapgrid";
  list.slice(0, 24).forEach(r => {
    const b = document.createElement("button"); b.className = "mapcard"; b.title = r.name || t("nameless");
    try { b.appendChild(figureCanvas(r.parts.map(p => p.s), r.dir, 0.12)); } catch (e) {}
    const nm = document.createElement("span"); nm.textContent = r.name || t("nameless");
    b.appendChild(nm);
    b.onclick = () => { galMap.closePopup(); openGalleryItem(r); };
    grid.appendChild(b);
  });
  box.append(h, n, grid);
  return box;
}
async function byLabel(r) {
  if (r.names) return r.names.join(", ");
  if (r.uids && caps.user) {
    try { const ps = await caps.user.profiles(r.uids); return r.uids.map((u, i) => ps[u]?.name || t("player", { n: i + 1 })).join(", "); } catch (e) {}
  }
  return "";
}
async function openGalleryItem(r) {
  const rec = { parts: r.parts.map(p => p.s), dir: r.dir, home: r.home, by: await byLabel(r), name: r.name, staff: r.staff, mid: r.mode === "online" };
  openStage(rec, { canUnfold: true, replay: true });
}
$("goGallery").onclick = openGallery;
