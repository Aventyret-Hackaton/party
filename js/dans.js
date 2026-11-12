// Dansläget: gubben dansar när man lutar och skakar telefonen, till introloopen.
//
// - Telefonens rörelsesensor (DeviceOrientation och DeviceMotion). På iPhone måste man ge lov,
//   och det får bara frågas efter ett tryck, därför startar allt med knappen Dansa!.
// - Varje del av gubben är en egen canvas och rör sig för sig, som en marionett: lutar man
//   svajar kroppen, och huvudet och benen hänger efter med fjädring. Skakar man hoppar gubben,
//   skakar man hårt snurrar den.
// - Gubben gungar i takt med basen i introloopen. Utan ljud gungar den i 120 slag per minut.
// - Utan sensor (dator, eller om man säger nej) dansar gubben själv och följer musen.

const DANCE = { on: false, raf: 0, tilt: 0, auto: false, mouse: null, parts: [], fig: 0, figV: 0,
  jump: 0, jumpV: 0, spin: 0, spinV: 0, beat: 0, energy: 0, avg: 0, t0: 0, an: null, src: null };

/* ---------- Sensorer ---------- */
function onTilt(e) {
  if (e.gamma == null) return;
  // Hur skärmen är vriden spelar roll: i liggande läge är det beta som är sidled
  const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  const side = ang === 90 ? e.beta : ang === -90 || ang === 270 ? -e.beta : e.gamma;
  DANCE.tilt = Math.max(-45, Math.min(45, side || 0));
  DANCE.auto = false;
}
function onShake(e) {
  const a = e.acceleration || e.accelerationIncludingGravity; if (!a) return;
  const g = e.acceleration ? 0 : 9.8;
  const m = Math.abs(Math.hypot(a.x || 0, a.y || 0, a.z || 0) - g);
  if (m > 14 && DANCE.jump === 0) { DANCE.jumpV = -Math.min(22, m * .9); voiceSay(); }   // hopp, och gubben säger sin catchphrase
  if (m > 28 && !reduceMotion) DANCE.spinV = (DANCE.tilt < 0 ? -1 : 1) * 26;    // snurr
}
function onMouse(e) { DANCE.mouse = (e.clientX / innerWidth - .5) * 2; }
async function askSensors() {
  // iPhone: frågan måste ställas direkt i trycket
  const ask = async C => { try { return C && typeof C.requestPermission === "function" ? await C.requestPermission() : "granted"; } catch (e) { return "denied"; } };
  const [o, m] = await Promise.all([ask(window.DeviceOrientationEvent), ask(window.DeviceMotionEvent)]);
  if (o === "granted" && "DeviceOrientationEvent" in window) addEventListener("deviceorientation", onTilt);
  if (m === "granted" && "DeviceMotionEvent" in window) addEventListener("devicemotion", onShake);
  return o === "granted" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
}

/* ---------- Musiken och takten ---------- */
function startDanceMusic() {
  if (!soundOn) return;
  const a = ac();
  // Basen i musiken läses av med en analysator, så att gubben gungar i takt
  if (a && !DANCE.src) {
    try {
      DANCE.src = a.createMediaElementSource(introAudio);
      DANCE.an = a.createAnalyser(); DANCE.an.fftSize = 256;
      DANCE.src.connect(DANCE.an); DANCE.an.connect(a.destination);
    } catch (e) { DANCE.src = null; DANCE.an = null; }
  }
  introAudio.currentTime = 0;
  introAudio.play().catch(() => {});
}
function beatLevel(time) {
  if (DANCE.an && soundOn && !introAudio.paused) {
    const d = new Uint8Array(DANCE.an.frequencyBinCount); DANCE.an.getByteFrequencyData(d);
    let e = 0; for (let i = 1; i < 8; i++) e += d[i]; e /= 7 * 255;
    DANCE.avg += (e - DANCE.avg) * .02;
    const kick = Math.max(0, e - DANCE.avg) * 6;
    DANCE.energy = Math.max(kick, DANCE.energy * .86);
    return Math.min(1, DANCE.energy);
  }
  return Math.pow(Math.abs(Math.sin(time * Math.PI * 2)), 4);   // 120 slag per minut
}

/* ---------- Dansen ---------- */
function danceFrame(now) {
  if (!DANCE.on) return;
  const time = (now - DANCE.t0) / 1000, amp = reduceMotion ? .35 : 1;
  // Vart gubben lutar: telefonen, annars musen, annars gungar den själv
  let tilt = DANCE.tilt;
  if (DANCE.auto) tilt = DANCE.mouse != null ? DANCE.mouse * 35 : Math.sin(time * 1.6) * 25;
  const beat = beatLevel(time);
  // Hela gubben: svajar från fötterna, med fjädring
  DANCE.figV += ((tilt * .35) - DANCE.fig) * .08; DANCE.figV *= .82; DANCE.fig += DANCE.figV;
  // Hopp och snurr
  DANCE.jumpV += 1.6; DANCE.jump = Math.min(0, DANCE.jump + DANCE.jumpV); if (DANCE.jump === 0) DANCE.jumpV = 0;
  DANCE.spin += DANCE.spinV; DANCE.spinV *= .93;
  if (Math.abs(DANCE.spinV) < .4) { DANCE.spinV = 0; DANCE.spin += (Math.round(DANCE.spin / 360) * 360 - DANCE.spin) * .15; }
  const bob = -beat * 10 * amp;
  const fig = $("figure");
  fig.style.transform = `translate(${DANCE.fig * 1.2 * amp}px, ${DANCE.jump * amp + bob}px) rotate(${DANCE.fig * amp}deg) rotateY(${DANCE.spin}deg)`;
  // Varje del: följer efter med fjädring, delarna vickar åt olika håll i takt
  const n = DANCE.parts.length, v = fig.classList.contains("v");
  DANCE.parts.forEach((p, i) => {
    const pos = n > 1 ? i / (n - 1) : .5;                       // 0 = överst/först, 1 = nederst/sist
    const lean = (pos < .5 ? 1 : -1) * tilt * (.5 - Math.abs(pos - .5) * .4);
    const wig = (i % 2 ? -1 : 1) * beat * 9;
    const target = (lean * .7 + wig) * amp;
    p.v += (target - p.a) * (.12 - i * .012); p.v *= .8; p.a += p.v;
    p.el.style.transform = v ? `rotate(${p.a}deg)` : `rotate(${p.a * .6}deg) translateY(${-beat * 6 * amp * (i % 2 ? 1 : -1)}px)`;
  });
  DANCE.raf = requestAnimationFrame(danceFrame);
}

async function startDance() {
  if (DANCE.on || !ST) return;
  startDanceMusic();                     // musiken startar direkt i trycket, annars stoppar iPhone den
  const sensor = await askSensors();
  DANCE.on = true; DANCE.auto = !sensor; DANCE.t0 = performance.now();
  Object.assign(DANCE, { tilt: 0, fig: 0, figV: 0, jump: 0, jumpV: 0, spin: 0, spinV: 0, energy: 0 });
  const fig = $("figure"), n = fig.children.length, v = fig.classList.contains("v");
  // Delarna hänger i lederna: överdelen vickar runt halsen, resten hänger från sin övre (eller vänstra) kant
  DANCE.parts = [...fig.children].map((el, i) => {
    el.style.transition = "none";
    el.style.transformOrigin = v ? (i === 0 && n > 1 ? "50% 100%" : "50% 0") : (i === 0 && n > 1 ? "100% 50%" : "0 50%");
    return { el, a: 0, v: 0 };
  });
  fig.style.transformOrigin = v ? "50% 100%" : "50% 100%";
  document.body.classList.add("dancing");
  $("danceBar").hidden = false;
  $("danceHint").textContent = t(sensor ? "danceTilt" : "danceAuto");
  $("moreBelow").hidden = true;
  addEventListener("mousemove", onMouse);
  fig.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  // Dansen får en egen plats i historiken, så att telefonens bakåt (eller svep på Android)
  // avslutar dansen i stället för att lämna gubben
  navPush({ party: "dance" });
  DANCE.raf = requestAnimationFrame(danceFrame);
  setTimeout(() => { if (DANCE.on) voiceSay(true); }, 1200);   // catchphrase när dansen börjar
}
function stopDance() {
  if (!DANCE.on) return;
  DANCE.on = false; cancelAnimationFrame(DANCE.raf);
  removeEventListener("deviceorientation", onTilt);
  removeEventListener("devicemotion", onShake);
  removeEventListener("mousemove", onMouse);
  introAudio.pause();
  const fig = $("figure"); fig.style.transform = ""; fig.style.transformOrigin = "";
  DANCE.parts.forEach(p => { p.el.style.transform = ""; p.el.style.transformOrigin = ""; p.el.style.transition = ""; });
  DANCE.parts = [];
  document.body.classList.remove("dancing");
  $("danceBar").hidden = true;
  if (typeof syncMoreBelow === "function") syncMoreBelow();
}
$("danceBtn").onclick = startDance;
// Klar: avsluta dansen och ta bort dansens plats i historiken
$("danceStop").onclick = () => {
  stopDance();
  if (history.state?.party === "dance") { navSkip = true; navDepth = Math.max(0, navDepth - 1); history.back(); }
};
// Ljudknappen: av och på mitt i dansen
$("soundBtn").addEventListener("click", () => setTimeout(() => { if (!DANCE.on) return; if (soundOn) startDanceMusic(); else introAudio.pause(); }));
document.addEventListener("visibilitychange", () => { if (document.hidden && DANCE.on) stopDance(); });
