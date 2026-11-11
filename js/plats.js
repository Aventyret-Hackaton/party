// Var spelarna är. Webbläsaren frågar om spelaren vill dela sin plats, och vi tar närmaste stad i listan
// (js/stader.js). Säger man nej, eller om platsen inte går att få fram, bor gubben på Påskön.

const HERE = { key: "", state: "" };   // state: "" = inte frågat än, "asking", "found", "none"
let herePromise = null;

function nearestCity(lat, lon) {
  const rad = Math.PI / 180;
  let best = null, bestD = Infinity;
  for (const c of CITIES) {
    // avstånd på jordklotet (haversine)
    const dLa = (c[3] - lat) * rad, dLo = (c[4] - lon) * rad;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(lat * rad) * Math.cos(c[3] * rad) * Math.sin(dLo / 2) ** 2;
    if (a < bestD) { bestD = a; best = c; }
  }
  return cityKey(best);
}

// Fråga om platsen en gång. Svaret (en stad) används för resten av besöket.
function locate() {
  if (herePromise) return herePromise;
  HERE.state = "asking"; renderWhere();
  herePromise = new Promise(resolve => {
    const done = (key, state) => { HERE.key = key; HERE.state = state; renderWhere(); resolve(key); };
    const none = err => {
      done(EASTER_ISLAND, "none");
      if (!err || err.code !== 1) herePromise = null;   // 1 = spelaren sa nej. Annars kan vi fråga igen nästa gång.
    };
    if (!navigator.geolocation) return none();
    navigator.geolocation.getCurrentPosition(
      p => done(nearestCity(p.coords.latitude, p.coords.longitude), "found"),
      none,
      { timeout: 15000, maximumAge: 10 * 60 * 1000 }
    );
  });
  return herePromise;
}

function renderWhere() {
  const text = HERE.state === "asking" ? t("locating") : HERE.state === "found" ? placeLabel(HERE.key) : HERE.state === "none" ? t("noPlace") : "";
  document.querySelectorAll(".where-now").forEach(el => el.textContent = text);
}
