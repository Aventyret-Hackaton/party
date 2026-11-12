// Catchphrase: den som vecklar ut spelar in en kort replik med mikrofonen innan avtäckningen.
// Gubben säger den med en uppskruvad, tecknad röst när namnet visas och när den dansar.
// Sparas gubben i galleriet laddas ljudet upp till servern (PUT /api/gallery/:id/voice) och spelas
// när man öppnar gubben i galleriet.
//
// Mikrofonen fungerar bara på https (Heroku) eller localhost, inte på en lokal ip-adress.

const VOICE = { blob: null, src: null, buf: null, rec: null, stream: null, timer: null, left: 0, lastSay: 0, msg: "", discard: false };
const VOICE_MAX = 6;          // längsta inspelning i sekunder
const VOICE_RATE = 1.45;      // högre och snabbare än inspelningen: låter som en tecknad figur

// Vilket ljudformat webbläsaren kan spela in i. iPhone spelar in i mp4, Chrome och Firefox i webm eller ogg.
function voiceType() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"].find(m => MediaRecorder.isTypeSupported(m)) || "";
}

// Anropas från openStage (js/scen.js) varje gång scenen öppnas
function voiceSetup(rec, opts) {
  voiceStopRec(true);
  Object.assign(VOICE, { blob: null, buf: null, lastSay: 0, msg: "", src: rec.voiceUrl || null });
  // Inspelning bara när man själv ska veckla ut en ny gubbe, inte i galleriet
  const can = opts.canUnfold && !opts.replay && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  $("voiceBox").hidden = !can;
  voiceRender();
}
function voiceRender() {
  $("voiceRec").textContent = VOICE.rec ? "■ " + t("voiceStop") : VOICE.blob ? "🎤 " + t("voiceRedo") : "🎤 " + t("voiceRec");
  $("voiceRec").classList.toggle("recording", !!VOICE.rec);
  $("voicePlay").hidden = !VOICE.blob || !!VOICE.rec;
  $("voicePlay").textContent = "▶ " + t("voicePlay");
  $("voiceAgain").hidden = !VOICE.src;
  $("voiceAgain").textContent = "🔊 " + t("voicePlay");
  $("voiceMsg").textContent = VOICE.rec ? t("voiceRecording", { n: VOICE.left }) : VOICE.msg ? t(VOICE.msg) : "";
}

/* ---------- Spela in ---------- */
async function voiceStartRec() {
  if (VOICE.rec) return voiceStopRec();
  try { VOICE.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { VOICE.msg = "voiceDenied"; voiceRender(); return; }
  const type = voiceType(), chunks = [];
  let r;
  try { r = new MediaRecorder(VOICE.stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined); }
  catch (e) { r = new MediaRecorder(VOICE.stream); }
  r.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  r.onstop = () => {
    if (VOICE.stream) { VOICE.stream.getTracks().forEach(tr => tr.stop()); VOICE.stream = null; }
    if (VOICE.discard) { VOICE.discard = false; return; }
    const blob = new Blob(chunks, { type: (r.mimeType || type || "audio/webm").split(";")[0] });
    if (blob.size < 500) { voiceRender(); return; }   // för kort, inget sparas
    Object.assign(VOICE, { blob, src: blob, buf: null, msg: "voiceHint" });
    voiceRender();
    voiceSay(true);                                    // spela upp direkt, så att man hör hur det blev
  };
  VOICE.rec = r; VOICE.left = VOICE_MAX; VOICE.msg = "";
  r.start();
  VOICE.timer = setInterval(() => { VOICE.left--; if (VOICE.left <= 0) voiceStopRec(); else voiceRender(); }, 1000);
  voiceRender();
}
// discard: släng inspelningen, till exempel när man lämnar scenen mitt i
function voiceStopRec(discard) {
  clearInterval(VOICE.timer);
  const r = VOICE.rec; VOICE.rec = null;
  if (r && r.state !== "inactive") { VOICE.discard = !!discard; r.stop(); }
  else if (VOICE.stream) { VOICE.stream.getTracks().forEach(tr => tr.stop()); VOICE.stream = null; }
  if ($("voiceRec")) voiceRender();
}

/* ---------- Spela upp med figurröst ---------- */
async function voiceLoad() {
  if (VOICE.buf || !VOICE.src) return VOICE.buf;
  const a = ac(); if (!a) return null;
  const src = VOICE.src;
  try {
    const data = src instanceof Blob ? await src.arrayBuffer() : await (await fetch(src)).arrayBuffer();
    const buf = await new Promise((res, rej) => a.decodeAudioData(data, res, rej));   // Safari vill ha callback-formen
    if (VOICE.src === src) VOICE.buf = buf;
  } catch (e) { console.warn("Catchphrase gick inte att läsa", e); }
  return VOICE.buf;
}
// force: spela även om den nyss spelades (annars högst var tredje och en halv sekund, till exempel när man skakar i dansen)
async function voiceSay(force) {
  if (!VOICE.src || !soundOn) return;
  const now = performance.now();
  if (!force && now - VOICE.lastSay < 3500) return;
  VOICE.lastSay = now;
  const buf = await voiceLoad(), a = ac();
  if (!buf || !a) return;
  const s = a.createBufferSource(); s.buffer = buf; s.playbackRate.value = VOICE_RATE;
  const g = a.createGain(); g.gain.value = 1.4;
  s.connect(g).connect(a.destination); s.start();
}

/* ---------- Spara med gubben i galleriet ---------- */
// Anropas när värden har valt Spara (js/scen.js). Bara servergalleriet sparar ljud.
async function voiceUpload(galleryId) {
  const id = apiId(galleryId);
  if (!VOICE.blob || !id || !myKeys[id]) return;
  try {
    const r = await fetch(`/api/gallery/${id}/voice`, { method: "PUT", headers: { "Content-Type": VOICE.blob.type || "audio/webm", "X-Token": myKeys[id] }, body: VOICE.blob });
    if (r.ok) { const g = gallery.find(x => x.id === galleryId); if (g) g.voice = true; }
    else console.warn("Catchphrasen sparades inte", r.status);
  } catch (e) { console.warn(e); }
}
// Ljudet för en gubbe i galleriet
const voiceUrlFor = r => r.voice && apiId(r.id) ? `/api/gallery/${apiId(r.id)}/voice` : null;

$("voiceRec").onclick = voiceStartRec;
$("voicePlay").onclick = () => voiceSay(true);
$("voiceAgain").onclick = () => voiceSay(true);
