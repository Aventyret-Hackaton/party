// Pausmusik: en luftig flöjt över en mjuk bordunton, syntetiserad med Web Audio.
// Melodin hittas på medan den spelar (i D-dorisk), så den upprepar sig aldrig exakt.
//
// När den spelar:
//   - online: när man väntar, alltså i väntrummet, när någon annan ritar och i pausen
//   - i rummet: hela tiden medan ni ritar och lämnar över telefonen
// Den tystnar på scenen, där trumvirveln och fanfaren tar över, och utanför spelet.

const MUSIC_ONLINE = ["s-lobby", "s-wait", "s-pause"];
const MUSIC_ROOM = ["s-handoff", "s-draw", "s-face"];
const SCALE = [293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99]; // D-dorisk, D4 till G5

let MU = null;   // { master, verb, timer, next, step, phrase, drone }

function musicWanted(id) {
  if (!soundOn || document.hidden) return false;
  if (typeof ON !== "undefined" && ON) return MUSIC_ONLINE.includes(id);
  return MUSIC_ROOM.includes(id);
}
function syncMusic(id = currentScreen) {
  if (musicWanted(id)) startMusic(); else stopMusic();
}

// Ett kort, genererat eko så att flöjten låter som i ett stort rum
function reverb(a) {
  const len = a.sampleRate * 2.6, b = a.createBuffer(2, len, a.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const v = a.createConvolver(); v.buffer = b; return v;
}

// En flötton: mjuk grundton, lite överton, vibrato som kommer smygande och ett andningsljud i början
function fluteNote(a, f, t, d, vol) {
  const out = a.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(vol, t + .09);
  out.gain.setValueAtTime(vol * .85, t + Math.max(.1, d - .15));
  out.gain.exponentialRampToValueAtTime(.0005, t + d + .35);
  out.connect(MU.master); out.connect(MU.verb);
  const vib = a.createOscillator(), vg = a.createGain();
  vib.frequency.value = 5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .006, t + Math.min(.6, d));
  vib.connect(vg);
  for (const [type, mul, g] of [["sine", 1, 1], ["triangle", 2, .12]]) {
    const o = a.createOscillator(); o.type = type; o.frequency.value = f * mul;
    vg.connect(o.frequency);
    const og = a.createGain(); og.gain.value = g;
    o.connect(og).connect(out); o.start(t); o.stop(t + d + .4);
  }
  vib.start(t); vib.stop(t + d + .4);
  // andning
  const n = a.createBufferSource(); n.buffer = noiseBuffer(a);
  const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f * 2; bp.Q.value = 3;
  const ng = a.createGain(); ng.gain.setValueAtTime(vol * .5, t); ng.gain.exponentialRampToValueAtTime(.0005, t + .18);
  n.connect(bp).connect(ng).connect(out); n.start(t); n.stop(t + .2);
}

// Bordun: D och A lågt, som andas långsamt
function startDrone(a, t) {
  const g = a.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + 3);
  g.connect(MU.master); g.connect(MU.verb);
  const swell = a.createOscillator(), sg = a.createGain();
  swell.frequency.value = .07; sg.gain.value = .02; swell.connect(sg).connect(g.gain); swell.start(t);
  const oscs = [146.83, 220].map(f => { const o = a.createOscillator(); o.type = "sine"; o.frequency.value = f; o.connect(g); o.start(t); return o; });
  return { g, oscs: [...oscs, swell] };
}

// Nästa fras: en slingrande melodi som mest går i små steg och vilar på en lång ton på slutet
function makePhrase() {
  const notes = [], len = 4 + Math.floor(Math.random() * 4);
  let i = MU.step;
  for (let k = 0; k < len; k++) {
    const r = Math.random();
    i += r < .35 ? 1 : r < .7 ? -1 : r < .82 ? 2 : r < .94 ? -2 : 0;
    i = Math.max(0, Math.min(SCALE.length - 1, i));
    const last = k === len - 1;
    notes.push({ f: SCALE[i], d: last ? 1.6 + Math.random() : [.42, .42, .84, .63][Math.floor(Math.random() * 4)] });
  }
  // landa ofta på D eller A, så att det låter hemma
  if (Math.random() < .6) notes[notes.length - 1].f = SCALE[[0, 4, 7][Math.floor(Math.random() * 3)]];
  MU.step = SCALE.indexOf(notes[notes.length - 1].f);
  notes.push({ rest: .6 + Math.random() * 1.2 });
  return notes;
}

function startMusic() {
  if (MU) return;
  const a = ac(); if (!a) return;
  const t = a.currentTime + .1;
  MU = { step: 4, phrase: [], next: t + .8 };
  MU.master = a.createGain(); MU.master.gain.setValueAtTime(0, t); MU.master.gain.linearRampToValueAtTime(.14, t + 1.5);
  MU.master.connect(a.destination);
  MU.verb = reverb(a); const wet = a.createGain(); wet.gain.value = .35; MU.verb.connect(wet).connect(MU.master);
  MU.drone = startDrone(a, t);
  // Lägg ut tonerna en bit i förväg, så att det inte hackar
  MU.timer = setInterval(() => {
    while (MU && MU.next < a.currentTime + 1.2) {
      if (!MU.phrase.length) MU.phrase = makePhrase();
      const n = MU.phrase.shift();
      if (n.rest) { MU.next += n.rest; continue; }
      fluteNote(a, n.f, MU.next, n.d, .5);
      MU.next += n.d;
    }
  }, 250);
}
function stopMusic() {
  if (!MU) return;
  const m = MU; MU = null;
  clearInterval(m.timer);
  const a = AC, t = a.currentTime;
  m.master.gain.cancelScheduledValues(t);
  m.master.gain.setValueAtTime(m.master.gain.value, t);
  m.master.gain.linearRampToValueAtTime(0, t + .8);
  setTimeout(() => { m.drone.oscs.forEach(o => { try { o.stop(); } catch (e) {} }); m.master.disconnect(); }, 1000);
}

// Ljudknappen och när sidan läggs i bakgrunden
$("soundBtn").addEventListener("click", () => setTimeout(() => syncMusic()));
document.addEventListener("visibilitychange", () => syncMusic());
