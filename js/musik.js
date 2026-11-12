// Partymusik medan ni ritar och väntar: en discoslinga i fyra stämmor, syntetiserad med Web Audio.
//
// Stämmorna: trummor, bas, ackord och melodi. Melodin hittas på av en slumpgenerator som får
// taktens nummer som frö, så den är likadan på alla telefoner men byts ut var 32:a takt.
//
// Takten räknas från serverns klocka (serverNow i js/online.js), inte från när musiken startade.
// Därför ligger alla telefoner i samma takt, och sitter flera spelare i samma rum (samma wifi)
// kan de dela på stämmorna: servern berättar hur många vi är i rummet (band.m) och vilken plats
// jag har (band.k). Två telefoner: den ena spelar trummor och ackord, den andra bas och melodi.
// Fyra telefoner: en stämma var. Tillsammans blir de en ljudmaskin. Den som spelar själv,
// eller sitter i ett annat rum, spelar alla stämmor.
//
// När den spelar:
//   - online: i väntrummet, när man ritar och när någon annan ritar
//   - i rummet: hela tiden medan ni ritar och lämnar över telefonen
// Den tystnar på scenen, där trumvirveln och fanfaren tar över, och utanför spelet.
//
// Här finns också den ledsamma flöjten som spelar när tiden för en del har gått ut (js/timer.js).

const MUSIC_ONLINE = ["s-lobby", "s-wait", "s-draw", "s-face"];
const MUSIC_ROOM = ["s-handoff", "s-draw", "s-face"];
const VOICES = ["drums", "bass", "chords", "lead"];
const BPM = 122, STEP_MS = 60000 / BPM / 4;   // en sextondel
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
// Am – F – C – G, en takt per ackord
const CHORDS = [[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]];
const ROOTS = [45, 41, 48, 43];
const PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88];   // A-moll pentaton

let MU = null;

function musicWanted(id) {
  if (!soundOn || document.hidden) return false;
  if (typeof ON !== "undefined" && ON) return MUSIC_ONLINE.includes(id);
  return MUSIC_ROOM.includes(id);
}
function syncMusic(id = currentScreen) {
  if (musicWanted(id)) startMusic(); else stopMusic();
}

// Vilka stämmor den här telefonen spelar
function myVoices() {
  const b = typeof ON !== "undefined" && ON?.game?.band;
  if (!b || b.m < 2) return VOICES;
  if (b.m > VOICES.length) return [VOICES[b.k % VOICES.length]];
  return VOICES.filter((_, i) => i % b.m === b.k);
}

// Samma tal på alla telefoner för samma frö
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
// Melodin för en takt: åtta takter som upprepas fyra gånger, sedan en ny
const leadCache = new Map();
function leadBar(bar) {
  const seed = (bar % 8) + 1000 * Math.floor(bar / 32);
  if (leadCache.has(seed)) return leadCache.get(seed);
  const r = rng(seed * 7919 + 17), notes = [];
  let i = 2 + Math.floor(r() * 3);
  for (let st = 0; st < 16; st++) {
    const want = st % 4 === 0 ? .7 : st % 2 === 0 ? .45 : .18;
    if (r() < want) { i = Math.max(0, Math.min(PENTA.length - 1, i + Math.floor(r() * 5) - 2)); notes[st] = PENTA[i]; }
  }
  if (leadCache.size > 64) leadCache.clear();
  leadCache.set(seed, notes);
  return notes;
}

/* ---------- Instrumenten ---------- */
function env(a, g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function kick(a, t) {
  const o = a.createOscillator(), g = a.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + .12);
  env(a, g, t, 1, .003, .3);
  o.connect(g).connect(MU.bus.drums); o.start(t); o.stop(t + .35);
}
function noiseHit(a, t, type, freq, q, peak, decay) {
  const s = a.createBufferSource(); s.buffer = MU.noise;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); env(a, g, t, peak, .002, decay);
  s.connect(f).connect(g).connect(MU.bus.drums); s.start(t); s.stop(t + decay + .05);
}
function clap(a, t) { for (const d of [0, .012, .024]) noiseHit(a, t + d, "bandpass", 1500, .8, .5, .14); }
function synth(a, f, t, d, type, peak, cutoff, out, detune = 0) {
  const o = a.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
  const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 4;
  lp.frequency.setValueAtTime(cutoff, t); lp.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff / 5), t + d);
  const g = a.createGain(); env(a, g, t, peak, .005, d);
  o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + d + .05);
}

// Allt som ska låta på sextondel nummer n (räknat från 1970), vid ljudtiden t
function playStep(a, n, t) {
  const st = n % 16, bar = Math.floor(n / 16), ci = bar % 4;
  const fill = bar % 8 === 7, mine = myVoices();
  if (mine.includes("drums")) {
    if (st % 4 === 0) kick(a, t);
    if (st === 4 || st === 12) clap(a, t);
    if (st % 4 === 2) noiseHit(a, t, "highpass", 7000, .5, .22, .16);   // öppen hi-hat på efterslaget
    else if (st % 2 === 1) noiseHit(a, t, "highpass", 9000, .5, .08, .04);
    if (fill && st >= 12) noiseHit(a, t, "bandpass", 2200, .9, .35, .09);   // trumvirvel inför nästa varv
  }
  if (mine.includes("bass") && st % 2 === 0) {
    synth(a, midi(ROOTS[ci] + (st % 4 === 2 ? 12 : 0)), t, STEP_MS * 1.6 / 1000, "sawtooth", .55, 900, MU.bus.bass);
  }
  if (mine.includes("chords") && [2, 6, 10, 13].includes(st)) {
    for (const m of CHORDS[ci]) for (const det of [-7, 7]) synth(a, midi(m), t, .22, "square", .1, 2400, MU.bus.chords, det);
  }
  if (mine.includes("lead") && !fill) {
    const note = leadBar(bar)[st];
    if (note) { synth(a, midi(note), t, .18, "triangle", .32, 5000, MU.bus.lead); synth(a, midi(note + 12), t, .1, "square", .05, 3000, MU.bus.lead); }
  }
}

/* ---------- Spela i takt med serverns klocka ---------- */
function schedule() {
  const a = AC; if (!MU || !a) return;
  // Kopplingen mellan serverns tid och ljudets tid, utjämnad så att tonerna inte hackar
  const clockNow = typeof serverNow === "function" ? serverNow() : Date.now();
  const anchor = clockNow - a.currentTime * 1000;
  MU.anchor = MU.anchor == null || Math.abs(anchor - MU.anchor) > 60 ? anchor : MU.anchor + (anchor - MU.anchor) * .05;
  const lat = (a.outputLatency || a.baseLatency || 0) * 1000;   // tiden det tar för ljudet att komma ut ur högtalaren
  const now = MU.anchor + a.currentTime * 1000 + lat, until = now + 300;
  let n = Math.max(MU.last + 1, Math.ceil((now + 40) / STEP_MS));
  for (; n * STEP_MS <= until; n++) {
    const t = (n * STEP_MS - MU.anchor - lat) / 1000;
    if (t > a.currentTime) playStep(a, n, t);
    MU.last = n;
  }
}
function startMusic() {
  if (MU) return;
  const a = ac(); if (!a) return;
  const t = a.currentTime;
  MU = { last: -1, anchor: null, noise: null, bus: {} };
  const b = a.createBuffer(1, a.sampleRate * .5, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  MU.noise = b;
  MU.master = a.createGain(); MU.master.gain.setValueAtTime(0, t); MU.master.gain.linearRampToValueAtTime(.16, t + 1.2);
  const comp = a.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  MU.master.connect(comp).connect(a.destination);
  for (const [v, vol] of [["drums", .8], ["bass", .7], ["chords", .55], ["lead", .5]]) {
    MU.bus[v] = a.createGain(); MU.bus[v].gain.value = vol; MU.bus[v].connect(MU.master);
  }
  // Eko på melodin, en punkterad åttondel
  const dl = a.createDelay(1); dl.delayTime.value = STEP_MS * 3 / 1000;
  const fb = a.createGain(); fb.gain.value = .32;
  MU.bus.lead.connect(dl); dl.connect(fb).connect(dl); dl.connect(MU.master);
  MU.timer = setInterval(schedule, 50);
  schedule();
}
function stopMusic() {
  if (!MU) return;
  const m = MU; MU = null;
  clearInterval(m.timer);
  const a = AC, t = a.currentTime;
  m.master.gain.cancelScheduledValues(t);
  m.master.gain.setValueAtTime(document.hidden ? 0 : m.master.gain.value, t);   // dold sida: tyst direkt
  m.master.gain.linearRampToValueAtTime(0, t + .6);
  setTimeout(() => m.master.disconnect(), 1000);
}

/* ---------- Ledsam flöjt när tiden har gått ut ---------- */
// Ett kort, genererat eko så att flöjten låter som i ett stort rum
function reverb(a) {
  const len = a.sampleRate * 2.6, b = a.createBuffer(2, len, a.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const v = a.createConvolver(); v.buffer = b; return v;
}
// En flöjtton: mjuk grundton, lite överton, vibrato som kommer smygande och ett andningsljud i början
function fluteNote(a, f, t, d, vol, dry, wet) {
  const out = a.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(vol, t + .09);
  out.gain.setValueAtTime(vol * .85, t + Math.max(.1, d - .15));
  out.gain.exponentialRampToValueAtTime(.0005, t + d + .35);
  out.connect(dry); out.connect(wet);
  const vib = a.createOscillator(), vg = a.createGain();
  vib.frequency.value = 5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .008, t + Math.min(.6, d));
  vib.connect(vg);
  for (const [type, mul, g] of [["sine", 1, 1], ["triangle", 2, .12]]) {
    const o = a.createOscillator(); o.type = type; o.frequency.value = f * mul;
    vg.connect(o.frequency);
    if (d > 1) o.frequency.linearRampToValueAtTime(f * mul * .95, t + d);   // sista tonen sjunker
    const og = a.createGain(); og.gain.value = g;
    o.connect(og).connect(out); o.start(t); o.stop(t + d + .4);
  }
  vib.start(t); vib.stop(t + d + .4);
  const n = a.createBufferSource(); n.buffer = noiseBuffer(a);
  const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f * 2; bp.Q.value = 3;
  const ng = a.createGain(); ng.gain.setValueAtTime(vol * .5, t); ng.gain.exponentialRampToValueAtTime(.0005, t + .18);
  n.connect(bp).connect(ng).connect(out); n.start(t); n.stop(t + .2);
}
function sadFlute() {
  const a = ac(); if (!a) return;
  const t = a.currentTime + .05;
  const dry = a.createGain(); dry.gain.value = .3; dry.connect(a.destination);
  const verb = reverb(a), wet = a.createGain(); wet.gain.value = .35; verb.connect(wet).connect(dry);
  [[0, 440, .45], [.5, 392, .45], [1, 349.23, .45], [1.5, 329.63, 2]].forEach(([s, f, d]) => fluteNote(a, f, t + s, d, .5, dry, verb));
  // Partymusiken tystnar en stund medan flöjten sörjer
  if (MU) {
    const g = MU.master.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(.03, t + .3); g.setValueAtTime(.03, t + 3.4); g.linearRampToValueAtTime(.16, t + 5);
  }
  setTimeout(() => { dry.disconnect(); }, 7000);
}

// Ljudknappen och när sidan läggs i bakgrunden
$("soundBtn").addEventListener("click", () => setTimeout(() => syncMusic()));
document.addEventListener("visibilitychange", () => syncMusic());
