// Välkomstrutan i två steg:
//   1. "Spela" startar introljudet (det loopar) och skjuter konfetti.
//   2. "Ja, det är här det är party" stänger av ljudet och rutan, och man kan börja spela.
// Webbläsare spelar bara upp ljud efter ett tryck, därför startar ljudet först på Spela.

/* ---------- Introljud ---------- */
const introAudio = new Audio("assets/ljud/are-hare-er-party.mp3");
introAudio.loop = true;
introAudio.volume = 0.8;
introAudio.preload = "auto";
let introStarted = false, introDone = false;

function playIntro() {
  if (!soundOn || !introStarted || introDone) return;
  introAudio.play().catch(() => {});
}
function stopIntro() {
  introAudio.pause();
  introAudio.currentTime = 0;
}

$("introPlay").onclick = () => {
  introStarted = true;
  playIntro();
  if (soundOn) ac();                      // låser upp trumvirveln och fanfaren
  confetti(); fxStart();                  // fxStart hoppar över konfettin om man har valt mindre rörelse
  $("introPlay").hidden = true;
  $("introBtn").hidden = false;
  $("introBtn").focus();
};
$("introBtn").onclick = () => {
  introDone = true;
  stopIntro();
  const box = $("intro");
  box.classList.add("gone");
  setTimeout(() => { box.hidden = true; $("goSetup").focus(); }, reduceMotion ? 0 : 450);
};
// Ljudknappen uppe till höger stänger av och sätter på introljudet också
// (setTimeout: vänta tills start.js har hunnit växla soundOn)
$("soundBtn").addEventListener("click", () => setTimeout(() => { if (soundOn) playIntro(); else introAudio.pause(); }));

// Stänger man fönstret eller byter flik eller app tystnar introlåten, och den fortsätter när man kommer tillbaka
document.addEventListener("visibilitychange", () => { if (document.hidden) introAudio.pause(); else playIntro(); });
addEventListener("pagehide", () => introAudio.pause());

$("introPlay").focus();
