// Galleriet med filter på världsdel, land och stad.

/* ---------- Galleri ---------- */
let gallery = [], localGallery = [], galSub = null, galPoll = null;

// Nycklar för att få byta namn på gubbar man själv har sparat på servern
const myKeys = (() => { try { return JSON.parse(localStorage.getItem("party-keys") || "{}"); } catch (e) { return {}; } })();
function rememberKey(id, token) { myKeys[id] = token; try { localStorage.setItem("party-keys", JSON.stringify(myKeys)); } catch (e) {} }
const apiId = id => typeof id === "string" && id.startsWith("api:") ? id.slice(4) : null;

// En gruppbild (power-läget) har flera gubbar i figs, en vanlig gubbe har sina delar i parts
const isGroup = r => r && r.kind === "group" && Array.isArray(r.figs);
const fitRec = rec => isGroup(rec) ? fitGroup(rec) : fitSize(rec, "parts");
async function saveGallery(rec) {
  await apiReady;
  if (caps.api) {
    try {
      const r = await fetch("/api/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fitRec(rec)) });
      if (r.ok) {
        const { id, token } = await r.json();
        rememberKey(id, token);
        gallery.unshift({ ...rec, id: "api:" + id });
        return "api:" + id;
      }
      console.warn("Galleriet svarade", r.status);
    } catch (e) { console.warn(e); }
  } else if (caps.db && caps.canWrite) {
    try { const ref = await caps.db.collection("gallery").add(fitRec(rec)); return ref.id; }
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
// Första gången hämtas hela listan. Sedan bara gubbar som är nyare än den nyaste vi har.
let galNewest = 0;
async function loadApiGallery() {
  try {
    const r = await fetch("/api/gallery" + (galNewest ? "?since=" + galNewest : ""), { cache: "no-store" });
    if (!r.ok) return;
    const fresh = (await r.json()).map(g => ({ ...g, id: "api:" + g.id }));
    if (galNewest && !fresh.length) return;
    const known = new Set(gallery.map(g => g.id));
    gallery = galNewest ? [...fresh.filter(g => !known.has(g.id)), ...gallery] : fresh;
    galNewest = Math.max(galNewest, ...gallery.map(g => +apiId(g.id) || 0));
    if (currentScreen === "s-gallery") renderGallery();
  } catch (e) { console.warn(e); }
}
async function openGallery(fromNav) {
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
  renderGallery(); show("s-gallery", fromNav);
}
function allGallery() { return [...localGallery, ...gallery]; }
// Galleriet visas en sida i taget, så att det går fort även när det finns många gubbar
const GAL_PAGE = 24;
let galPage = 0;
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
  // Visa: alla, bara gubbar eller bara gruppbilder
  const kind = $("fKind").value;
  const shown = inCountry.filter(x => !fci.value || cityKey(x.c) === fci.value).map(x => x.r)
    .filter(r => !kind || (kind === "group") === isGroup(r));
  // Kartan visar alla gubbar. Trycker man på en stad visas bara den stadens gubbar i rutnätet.
  if (sheetPos !== "peek") renderMap(items, fci.value);
  renderSheetHint();
  const grid = $("galGrid"); grid.innerHTML = "";
  if (!shown.length) grid.innerHTML = `<p class="fine">${t("galEmpty")}</p>`;
  const pages = Math.max(1, Math.ceil(shown.length / GAL_PAGE));
  galPage = Math.min(galPage, pages - 1);
  renderPager(pages);
  shown.slice(galPage * GAL_PAGE, (galPage + 1) * GAL_PAGE).forEach(r => {
    const b = document.createElement("button"); b.className = "card" + (isGroup(r) ? " group" : "");
    const th = document.createElement("div"); th.className = "thumb";
    try {
      // Gruppbilden tar två kolumner i rutnätet
      if (isGroup(r)) th.appendChild(groupCanvas(r.figs, r.dir, 1000, Math.min(2, Math.max(1, devicePixelRatio || 1)) * .32, false));
      else { const parts = r.parts.map(p => p.s); th.appendChild(figureCanvas(parts, r.dir, thumbScale(parts.length, r.dir))); }
    } catch (e) {}
    // Gruppbilder från power-läget får blixten framför namnet
    const nm = document.createElement("b"); nm.textContent = (isGroup(r) ? "⚡ " : "") + (r.name || t("nameless"));
    const pl = document.createElement("span"); pl.textContent = placeLabel(r.home);
    b.append(th, nm, pl);
    b.onclick = () => openGalleryItem(r);
    // Admin: knappar för att byta namn och radera under kortet (js/admin.js)
    if (typeof isAdminMode === "function" && isAdminMode() && apiId(r.id)) {
      const cell = document.createElement("div"); cell.className = "card-cell" + (isGroup(r) ? " group" : "");
      cell.append(b, adminTools(r));
      grid.appendChild(cell);
    } else grid.appendChild(b);
  });
}
["fCont", "fCountry", "fCity", "fKind"].forEach(id => $(id).onchange = () => { galPage = 0; renderGallery(); });
// Bläddra: Föregående, Sida 2 av 5, Nästa. Syns bara när gubbarna inte får plats på en sida.
function renderPager(pages) {
  $("galPager").hidden = pages < 2;
  $("pagePrev").disabled = galPage === 0;
  $("pageNext").disabled = galPage >= pages - 1;
  $("pageNow").textContent = t("pageOf", { i: galPage + 1, n: pages });
}
function goPage(d) {
  galPage += d; renderGallery();
  scrollTo({ top: Math.max(0, $("galGrid").getBoundingClientRect().top + scrollY - 76), behavior: reduceMotion ? "auto" : "smooth" });
}
$("pagePrev").onclick = () => goPage(-1);
$("pageNext").onclick = () => goPage(1);
// Rita galleribilden i den storlek den visas (rutan är högst cirka 240 × 320), gånger skärmens pixeltäthet,
// så att strecken blir skarpa. Högst 2× för att inte äta minne när galleriet har många gubbar.
function thumbScale(n, dir) {
  const { W, H } = DIMS[dir], step = (dir === "v" ? H : W) - GAP;
  const fw = dir === "v" ? W : W + step * (n - 1), fh = dir === "v" ? H + step * (n - 1) : H;
  return Math.min(2, Math.max(1, devicePixelRatio || 1)) * Math.min(240 / fw, 320 / fh);
}

/* ---------- Kartpanelen: dra i greppet eller tryck på det ---------- */
// Tre lägen: "peek" (bara greppet syns), "half" (halva skärmen) och "full".
// Man drar bara i greppet. Drar man i kartan flyttar man kartan.
const SHEET_POS = ["peek", "half", "full"];
let sheetPos = "peek";
function setSheet(pos) {
  if (sheetPos === "peek" && pos !== "peek") refit = true;   // zooma så att alla syns när kartan öppnas
  sheetPos = pos;
  const sh = $("mapSheet"); sh.dataset.pos = pos; document.body.dataset.sheet = pos; sh.style.removeProperty("--shown");
  $("sheetGrip").setAttribute("aria-expanded", pos !== "peek");
  renderSheetHint();
  if (pos !== "peek") {
    renderMap(allGallery(), $("fCity").value);
    // Kartan måste få veta sin nya storlek när panelen har glidit klart
    setTimeout(settleMap, reduceMotion ? 50 : 360);
  }
}
function renderSheetHint() {
  const city = $("fCity").value;
  $("sheetHint").textContent = sheetPos === "peek" ? "– " + t("mapUp") : city ? "– " + placeLabel(city) : "";
}
(() => {
  const sh = $("mapSheet"), grip = $("sheetGrip");
  let drag = null;
  grip.addEventListener("pointerdown", e => {
    drag = { y: e.clientY, start: sh.getBoundingClientRect().height, moved: false, t: performance.now(), lastY: e.clientY, v: 0 };
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener("pointermove", e => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) < 6) return;
    if (!drag.moved) { drag.moved = true; sh.classList.add("dragging"); }
    const now = performance.now();
    drag.v = (e.clientY - drag.lastY) / Math.max(1, now - drag.t); drag.t = now; drag.lastY = e.clientY;
    const max = innerHeight * .88;
    sh.style.setProperty("--shown", Math.max(48, Math.min(max, drag.start - dy)) + "px");
  });
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null;
    sh.classList.remove("dragging");
    if (!d.moved) { setSheet(SHEET_POS[(SHEET_POS.indexOf(sheetPos) + 1) % 3]); return; }   // tryck: nästa läge
    // Närmaste läge, men en snabb svepning går ett steg vidare i den riktningen
    const h = sh.getBoundingClientRect().height;
    const stops = { peek: 64, half: innerHeight * .52, full: innerHeight * .88 };
    let pos = SHEET_POS.reduce((a, b) => Math.abs(stops[a] - h) < Math.abs(stops[b] - h) ? a : b);
    // En snabb svepning går till nästa läge i den riktningen, räknat från där panelen är nu
    if (d.v < -.6) pos = SHEET_POS.find(p => stops[p] > h + 10) || "full";
    if (d.v > .6) pos = [...SHEET_POS].reverse().find(p => stops[p] < h - 10) || "peek";
    setSheet(pos);
  };
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
  // Tangentbord: pil upp och ned byter läge, Enter och mellanslag går till nästa
  grip.addEventListener("keydown", e => {
    const i = SHEET_POS.indexOf(sheetPos);
    if (e.key === "ArrowUp") { e.preventDefault(); setSheet(SHEET_POS[Math.min(2, i + 1)]); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSheet(SHEET_POS[Math.max(0, i - 1)]); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSheet(SHEET_POS[(i + 1) % 3]); }
  });
})();
// Tryck på en stad: visa bara den stadens gubbar, och dra ned panelen till halvvägs så att de syns.
// Trycker man på samma stad igen visas alla igen.
function pickCity(key) {
  const c = findCity(key); if (!c) return;
  const same = $("fCity").value === key;
  galPage = 0;
  $("fCont").value = same ? "" : c[2]; renderGallery();
  $("fCountry").value = same ? "" : c[1]; renderGallery();
  $("fCity").value = same ? "" : key; renderGallery();
  if (sheetPos === "full") setSheet("half");
  if (!same) requestAnimationFrame(() => scrollTo({ top: Math.max(0, $("galGrid").getBoundingClientRect().top + scrollY - 76), behavior: reduceMotion ? "auto" : "smooth" }));
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
// picked: staden man har tryckt på, den markeras
async function renderMap(items, picked) {
  const box = $("galMap");
  try { await loadLeaflet(); }
  catch (e) { leafletP = null; box.innerHTML = `<p class="fine">${t("mapFail")}</p>`; return; }
  if (sheetPos === "peek" || currentScreen !== "s-gallery") return;
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
    const icon = L.divIcon({ className: "pin" + (key === picked ? " on" : ""), html: `<span>${list.length}</span>`, iconSize: [36, 36], iconAnchor: [18, 18] });
    const count = t(list.length === 1 ? "figCount1" : "figCount", { n: list.length });
    L.marker([c[3], c[4]], { icon, title: `${placeLabel(key)} – ${count}`, keyboard: true })
      .on("click", () => pickCity(key))
      .addTo(galLayer);
  }
  // Zooma bara om när det kommer nya städer, inte varje gång nya gubbar hämtas eller man väljer en stad
  const fit = String(byCity.size);
  if (fit !== lastFit && points.length) { lastFit = fit; fitPoints = points; refit = true; fitMap(); }
}
// Zooma så att alla städer syns. Görs igen när panelen har glidit klart och kartan har fått sin riktiga storlek.
let fitPoints = null, refit = false;
function settleMap() {
  if (!galMap) return;
  galMap.invalidateSize();
  if (refit) { refit = false; fitMap(); }
}
function fitMap() {
  if (!galMap || !fitPoints) return;
  if (fitPoints.length === 1) galMap.setView(fitPoints[0], 6);
  else galMap.fitBounds(fitPoints, { padding: [40, 40], maxZoom: 6 });
}
async function byLabel(r) {
  if (r.names) return r.names.join(", ");
  if (r.uids && caps.user) {
    try { const ps = await caps.user.profiles(r.uids); return r.uids.map((u, i) => ps[u]?.name || t("player", { n: i + 1 })).join(", "); } catch (e) {}
  }
  return "";
}
// Öppna en gubbe från galleriet. Webbläsarens bakåtknapp (eller svep bakåt) och Tillbaka går till galleriet igen,
// på samma ställe och med samma filter.
let galScroll = 0;
async function openGalleryItem(r) {
  if (isGroup(r)) {
    // Gruppbilden från ett power-läge: alla gubbar på scenen igen
    galScroll = scrollY;
    navPush({ party: "item" });
    openGroup({ figs: r.figs.map(f => f.map(p => p.s)), dir: r.dir, home: r.home, by: r.by || [], gang: r.name, galleryId: r.id }, { canUnfold: true, back: true });
    return;
  }
  const rec = { parts: r.parts.map(p => p.s), dir: r.dir, home: r.home, by: await byLabel(r), name: r.name, staff: r.staff, gang: r.gang || "", mid: r.mode === "online", galleryId: r.id, voiceUrl: voiceUrlFor(r) };
  galScroll = scrollY;   // sidan i galleriet (galPage) står kvar
  navPush({ party: "item" });
  openStage(rec, { canUnfold: true, replay: true, back: true });
}
async function backToGallery() {
  await openGallery(true);
  scrollTo(0, galScroll);
}
$("goGallery").onclick = () => openGallery();
