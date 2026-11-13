// Dela en gubbe eller en gruppbild: en länk som öppnar den direkt i spelet (…/?gubbe=123).
// På telefonen öppnas telefonens egen delameny. Annars kopieras länken.
// Bara gubbar i det gemensamma galleriet kan delas, eftersom länken behöver en adress.

function shareUrl(galleryId) {
  const id = apiId(galleryId);
  return id ? location.origin + "/?gubbe=" + id : "";
}
async function shareItem(galleryId, name) {
  const url = shareUrl(galleryId); if (!url) return;
  const text = t("shareText", { name: name || t("nameless") });
  try {
    if (navigator.share) { await navigator.share({ title: "Party", text, url }); return; }
  } catch (e) { if (e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(url); toast(t("shareCopied")); }
  catch (e) { prompt(t("shareCopy"), url); }
}
// En kort lapp längst ned som försvinner av sig själv
function toast(msg) {
  let el = $("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add("on");
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 2600);
}
function syncShare() {
  const id = ST?.rec.galleryId;
  $("shareBtn").hidden = !shareUrl(id);
}
$("shareBtn").onclick = () => shareItem(ST?.rec.galleryId, ST?.rec.name);

// Öppnades spelet från en delad länk? Visa gubben (eller gruppbilden), och bakåt går till galleriet.
(async () => {
  const id = new URLSearchParams(location.search).get("gubbe");
  if (!id || !/^\d{1,15}$/.test(id)) return;
  history.replaceState(history.state, "", location.pathname);   // länken används bara en gång
  // Vänta tills alla skript har laddats, de som kommer efter den här filen behövs också
  if (document.readyState !== "complete") await new Promise(r => addEventListener("load", r, { once: true }));
  await apiReady;
  if (!caps.api) return;
  try {
    const r = await fetch("/api/gallery/" + id, { cache: "no-store" });
    if (!r.ok) { toast(t("shareGone")); return; }
    const rec = await r.json();
    $("intro").hidden = true; stopIntro();
    await openGallery();
    openGalleryItem({ ...rec, id: "api:" + rec.id });
  } catch (e) { console.warn(e); }
})();
