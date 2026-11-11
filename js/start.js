// Språkväljare, ljudknapp och uppstart. Laddas sist.

/* ---------- Språkväljare, ljud och översättning av allt ---------- */
function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i]").forEach(el => el.textContent = t(el.dataset.i));
  document.querySelectorAll("[data-ph]").forEach(el => el.placeholder = t(el.dataset.ph));
  $("soundBtn").textContent = soundOn ? "♪ " + t("soundOn") : t("soundOff");
  $("soundBtn").setAttribute("aria-pressed", soundOn);
  renderWhere();
  renderSetupChips();
  if (currentScreen === "s-names") renderNameInputs();
  if (currentScreen === "s-draw") renderDrawTexts(), buildPalette(), syncTools();
  if (currentScreen === "s-lobby") renderLobby();
  if (currentScreen === "s-wait") renderWait();
  if (currentScreen === "s-pause") renderPause();
  if (currentScreen === "s-gallery") renderGallery();
  if (currentScreen === "s-faces") renderFaces();
  if (currentScreen === "s-stage" && ST) {
    $("unfoldBtn").textContent = ST.opts.replay ? t("replay") : t("unfold");
    if (!$("postShow").hidden) {
      $("figPlace").textContent = ST.rec.home ? t("livesIn", { place: placeLabel(ST.rec.home) }) + (ST.rec.mid ? ` (${t("midNote")})` : "") : "";
      $("figBy").textContent = ST.rec.by ? t("drawnBy", { names: ST.rec.by }) : "";
    }
  }
}
const ls = $("langSel");
Object.entries(LANGS).forEach(([k, v]) => { const o = document.createElement("option"); o.value = k; o.textContent = v; ls.appendChild(o); });
ls.value = lang;
ls.onchange = () => { lang = ls.value; try { localStorage.setItem("vg-lang", lang); } catch (e) {} applyI18n(); };
$("soundBtn").onclick = () => { soundOn = !soundOn; try { localStorage.setItem("vg-sound", soundOn ? "on" : "off"); } catch (e) {} if (soundOn) ac(); applyI18n(); };
$("brand").onclick = () => { leaveOnline(); show("s-home"); };

applyI18n();
