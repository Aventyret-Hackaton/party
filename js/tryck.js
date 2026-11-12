// Knappen "Tryck på tröja" på scenen. Öppnar Tryckskaparen med gubben redan inläst.
// Tryckskaparen hämtar gubben som SVG från vår server (GET /api/gallery/:id.svg, se tryck-svg.js).
// Det går bara för gubbar som är sparade i det gemensamma galleriet, eftersom bilden behöver en adress.
// Se docs/tryckskaparen-koppling.md.

/* ---------- Tryck på tröja ---------- */
const TRYCK_URL = "https://tryckskaparen.tifosi.se/#/teckning?bild=";
function tryckUrl(galleryId) {
  const id = apiId(galleryId);
  return id ? TRYCK_URL + encodeURIComponent(location.origin + "/api/gallery/" + id + ".svg") : "";
}
// Visa knappen om gubben på scenen har en adress i galleriet
function syncPrint() {
  const a = $("printBtn"), url = ST ? tryckUrl(ST.rec.galleryId) : "";
  a.hidden = !url;
  if (url) a.href = url;
}
