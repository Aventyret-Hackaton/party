// Ultraljud: telefonen "ropar ut" omgångens kod med toner som är för ljusa för att höras (17–20 kHz),
// och telefoner i samma rum som lyssnar med mikrofonen fångar upp den. Används av js/narhet.js.
//
// Så ser ett meddelande ut (cirka en sekund, upprepas):
//   START-ton, sedan fyra bokstäver i koden, sedan tystnad.
// Varje bokstav är en egen ton (17,8–19,6 kHz). Samtidigt spelas en taktton som växlar mellan två
// frekvenser för varje bokstav, så att två likadana bokstäver i rad ändå går att skilja åt.
// Mottagaren mäter styrkan på varje ton med Goertzel-algoritmen (en billig sorts frekvensanalys).

/* ---------- Ultraljud ---------- */
const UL_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // samma bokstäver som omgångarnas koder (online-server.js)
const UL_MARK = [17000, 17200], UL_START = 17400, UL_F0 = 17800, UL_DF = 80;
const UL_T = { start: 0.2, sym: 0.15, pause: 0.3, fade: 0.008 };
const UL_MSG = UL_T.start + 4 * UL_T.sym + UL_T.pause;   // ett meddelande i sekunder
const UL_FREQS = [...UL_MARK, UL_START, ...[...UL_ALPHA].map((_, i) => UL_F0 + i * UL_DF)];

// Lägg in ropet i ett ljudsammanhang: reps meddelanden med start t0. Fungerar även i OfflineAudioContext (test).
function ulSchedule(ctx, dest, code, t0, reps, level = 0.35) {
  const mk = () => { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(dest); g.gain.value = 0; return { o, g }; };
  const mark = mk(), letter = mk();
  // En ton: frekvensen byts när ljudet är tyst, och styrkan tonas in och ut så att det inte knäpper
  const tone = (v, f, a, b) => {
    v.o.frequency.setValueAtTime(f, a);
    v.g.gain.setValueAtTime(0, a);
    v.g.gain.linearRampToValueAtTime(level, a + UL_T.fade);
    v.g.gain.setValueAtTime(level, b - UL_T.fade);
    v.g.gain.linearRampToValueAtTime(0, b);
  };
  const idx = [...code].map(c => UL_ALPHA.indexOf(c));
  for (let r = 0; r < reps; r++) {
    let t = t0 + r * UL_MSG;
    tone(mark, UL_START, t, t + UL_T.start); t += UL_T.start;
    idx.forEach((li, k) => {
      tone(mark, UL_MARK[k % 2], t, t + UL_T.sym);
      tone(letter, UL_F0 + li * UL_DF, t, t + UL_T.sym);
      t += UL_T.sym;
    });
  }
  const end = t0 + reps * UL_MSG;
  [mark, letter].forEach(v => { v.o.start(t0); v.o.stop(end + 0.05); });
  return [mark.o, letter.o];
}

/* ---------- Ropa ut ---------- */
let ulShout = null;
// Ropa ut koden i upp till 60 sekunder. onEnd körs när det är slut.
function startShout(code, onEnd) {
  stopShout();
  if (!/^[A-HJ-NP-Z]{4}$/.test(code)) return false;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  const ctx = new AC(), reps = Math.ceil(60 / UL_MSG);
  ctx.resume().catch(() => {});
  const oscs = ulSchedule(ctx, ctx.destination, code, ctx.currentTime + 0.05, reps);
  const timer = setTimeout(() => { stopShout(); onEnd && onEnd(); }, reps * UL_MSG * 1000 + 200);
  ulShout = { ctx, oscs, timer, onEnd };
  return true;
}
function stopShout() {
  if (!ulShout) return;
  clearTimeout(ulShout.timer);
  ulShout.oscs.forEach(o => { try { o.stop(); } catch (e) {} });
  ulShout.ctx.close().catch(() => {});
  ulShout = null;
}

/* ---------- Lyssna ---------- */
// Styrkan på en frekvens i ett fönster med ljud (Goertzel)
function ulPower(x, w, sr, f) {
  const k = 2 * Math.cos(2 * Math.PI * f / sr);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < x.length; i++) { const s0 = x[i] * w[i] + k * s1 - s2; s2 = s1; s1 = s0; }
  return s1 * s1 + s2 * s2 - k * s1 * s2;
}
const ulWin = {};
// Vilka toner hörs i det här fönstret? Svarar { mark: 0 | 1 | "S" | null, letter: index | null }
function ulFrame(x, sr) {
  const n = x.length, w = ulWin[n] || (ulWin[n] = Float32Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))));
  const p = UL_FREQS.map(f => ulPower(x, w, sr, f));
  const letters = p.slice(3), noise = [...letters].sort((a, b) => a - b)[letters.length >> 1] + 1e-9;
  const loud = v => v > noise * 12 && v > 1e-4;
  let li = 0; letters.forEach((v, i) => { if (v > letters[li]) li = i; });
  const m = [p[0], p[1], p[2]], mi = m.indexOf(Math.max(...m));
  return { mark: loud(m[mi]) ? (mi === 2 ? "S" : mi) : null, letter: loud(letters[li]) ? li : null };
}
// Gör om en ström av fönster till koder. push(frame) svarar med en kod när ett helt meddelande har hörts.
function ulDecoder() {
  let st = "idle", startRun = 0, cur = 0, pend = null, pendRun = 0, votes = {}, syms = [], quiet = 0;
  const flush = () => { const k = Object.keys(votes); if (k.length) syms.push(+k.reduce((a, b) => votes[a] >= votes[b] ? a : b)); votes = {}; };
  const finish = () => { flush(); const ok = syms.length === 4; const code = ok ? syms.map(i => UL_ALPHA[i]).join("") : null; syms = []; return code; };
  return function push(f) {
    if (f.mark === "S") {
      quiet = 0;
      let out = null;
      if (st === "data") out = finish();
      if (st === "idle" && ++startRun < 2) return null;
      st = "start"; syms = []; votes = {}; pend = null;
      return out;
    }
    if (f.mark === 0 || f.mark === 1) {
      quiet = 0; startRun = 0;
      if (st === "idle") return null;
      if (st === "start") { if (f.mark !== 0) return null; st = "data"; cur = 0; votes = {}; }
      if (f.mark !== cur) {
        // Byt bokstav först när den nya takttonen har hörts två gånger i rad
        if (pend === f.mark) pendRun++; else { pend = f.mark; pendRun = 1; }
        if (pendRun < 2) return null;
        flush(); cur = f.mark; pend = null;
        if (syms.length >= 4) { st = "idle"; syms = []; return null; }
      } else pend = null;
      if (f.letter !== null) votes[f.letter] = (votes[f.letter] || 0) + 1;
      return null;
    }
    // Tystnad: meddelandet är slut
    startRun = 0;
    if (st !== "idle" && ++quiet > 4) { const out = st === "data" ? finish() : null; st = "idle"; return out; }
    return null;
  };
}

let ulListen = null;
// Lyssna med mikrofonen. onCode(kod) för varje meddelande som hörs. Svarar false om mikrofonen inte gick att få.
async function startListen(onCode) {
  stopListen();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !navigator.mediaDevices?.getUserMedia) return false;
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
  catch (e) { return false; }
  const ctx = new AC(); ctx.resume().catch(() => {});
  const src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser(), mute = ctx.createGain();
  an.fftSize = 2048; mute.gain.value = 0;
  src.connect(an); an.connect(mute); mute.connect(ctx.destination);   // tyst, men håller igång analysen i alla webbläsare
  const buf = new Float32Array(an.fftSize), dec = ulDecoder();
  const timer = setInterval(() => {
    an.getFloatTimeDomainData(buf);
    const code = dec(ulFrame(buf, ctx.sampleRate));
    if (code) onCode(code);
  }, 20);
  ulListen = { stream, ctx, timer };
  return true;
}
function stopListen() {
  if (!ulListen) return;
  clearInterval(ulListen.timer);
  ulListen.stream.getTracks().forEach(tr => tr.stop());
  ulListen.ctx.close().catch(() => {});
  ulListen = null;
}
