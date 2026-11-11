// Trumvirvel och fanfar, syntetiserat med Web Audio.

/* ---------- Ljud: trumvirvel och fanfar (syntetiserat) ---------- */
let AC = null;
function ac() {
  if (!soundOn) return null;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
  } catch (e) { return null; }
  return AC;
}
document.addEventListener("pointerdown", () => { if (soundOn) ac(); }, { once: true });
function noiseBuffer(a) {
  const b = a.createBuffer(1, a.sampleRate * 0.2, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function drumroll(sec) {
  const a = ac(); if (!a) return;
  const buf = noiseBuffer(a), t0 = a.currentTime;
  for (let tt = 0; tt < sec; tt += 0.045) {
    const s = a.createBufferSource(); s.buffer = buf;
    const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = .8;
    const g = a.createGain(); const v = 0.05 + 0.25 * (tt / sec);
    g.gain.setValueAtTime(v, t0 + tt); g.gain.exponentialRampToValueAtTime(0.001, t0 + tt + 0.06);
    s.connect(f).connect(g).connect(a.destination); s.start(t0 + tt); s.stop(t0 + tt + 0.08);
  }
}
function fanfare() {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + 0.02;
  const notes = [[0,392,.11],[.13,392,.11],[.26,392,.11],[.39,523.25,.6],[1.05,466.16,.16],[1.24,523.25,.16],[1.43,659.25,1.3]];
  const master = a.createGain(); master.gain.value = 0.22; master.connect(a.destination);
  const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600; lp.connect(master);
  const play = (st, f, d, vol = 1) => {
    for (const det of [-6, 6]) {
      const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det;
      const g = a.createGain();
      g.gain.setValueAtTime(0, t0 + st); g.gain.linearRampToValueAtTime(.5 * vol, t0 + st + .03);
      g.gain.setValueAtTime(.45 * vol, t0 + st + d * .8); g.gain.exponentialRampToValueAtTime(.001, t0 + st + d + .25);
      o.connect(g).connect(lp); o.start(t0 + st); o.stop(t0 + st + d + .3);
    }
  };
  notes.forEach(([s, f, d]) => play(s, f, d));
  [523.25, 783.99].forEach(f => play(1.43, f, 1.3, .6));
  // cymbal i slutet
  const s = a.createBufferSource(); s.buffer = noiseBuffer(a); s.loop = true;
  const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
  const g = a.createGain(); g.gain.setValueAtTime(.35, t0 + 1.43); g.gain.exponentialRampToValueAtTime(.001, t0 + 3.2);
  s.connect(hp).connect(g).connect(a.destination); s.start(t0 + 1.43); s.stop(t0 + 3.3);
}
