// Introljudet och välkomstrutan: ljudet loopas bakom rutan och tystnar direkt när man
// trycker på knappen "Ja, det är här det är party".
//
// Webbläsare spelar inte upp ljud förrän man har tryckt någonstans på sidan. Därför
// försöker vi spela direkt, och annars så fort man trycker någonstans i rutan utanför knappen.

/* ---------- Introljud ---------- */
const introAudio = new Audio("assets/ljud/are-hare-er-party.mp3");
introAudio.loop = true;
introAudio.volume = 0.8;
introAudio.preload = "auto";
let introDone = false;

function playIntro() {
  if (!soundOn || introDone) return;
  introAudio.play().catch(() => {});      // nekas tyst om man inte har tryckt än
}
function stopIntro() {
  introAudio.pause();
  introAudio.currentTime = 0;
}

$("introBtn").onclick = () => {
  introDone = true;
  stopIntro();
  if (soundOn) ac();                      // låser upp trumvirveln och fanfaren
  const box = $("intro");
  box.classList.add("gone");
  setTimeout(() => { box.hidden = true; $("goSetup").focus(); }, reduceMotion ? 0 : 450);
};
// Ett tryck i rutan (men inte på knappen) räcker för att webbläsaren ska släppa fram ljudet
$("intro").addEventListener("pointerdown", e => { if (e.target !== $("introBtn")) playIntro(); });
// Ljudknappen uppe till höger stänger av och sätter på introljudet också
// (setTimeout: vänta tills start.js har hunnit växla soundOn)
$("soundBtn").addEventListener("click", () => setTimeout(() => { if (soundOn) playIntro(); else introAudio.pause(); }));

$("introBtn").focus();
playIntro();
