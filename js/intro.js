// Introljudet och välkomstrutan: ljudet loopas på startsidan tills spelet börjar.
//
// Webbläsare spelar inte upp ljud förrän man har tryckt någonstans. Därför försöker vi
// spela direkt, och om det stoppas startar ljudet när man trycker på knappen i rutan.
// Ljudet fortsätter sedan på startsidan och tystnar när man går vidare in i spelet.

/* ---------- Introljud ---------- */
const introAudio = new Audio("assets/ljud/are-hare-er-party.mp3");
introAudio.loop = true;
introAudio.volume = 0.8;
introAudio.preload = "auto";

function playIntro() {
  if (!soundOn || currentScreen !== "s-home") return;
  introAudio.play().catch(() => {});      // nekas tyst om man inte har tryckt än
}
function stopIntro() {
  introAudio.pause();
  introAudio.currentTime = 0;
}

$("introBtn").onclick = () => {
  playIntro();
  if (soundOn) ac();                      // låser också upp trumvirveln och fanfaren
  const box = $("intro");
  box.classList.add("gone");
  setTimeout(() => { box.hidden = true; $("goSetup").focus(); }, reduceMotion ? 0 : 450);
};
// Ljudknappen uppe till höger stänger av och sätter på introljudet också
// (setTimeout: vänta tills start.js har hunnit växla soundOn)
$("soundBtn").addEventListener("click", () => setTimeout(() => { if (soundOn) playIntro(); else introAudio.pause(); }));

$("introBtn").focus();
playIntro();
