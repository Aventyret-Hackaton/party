# Krav för spelet

Gruppens kravlista (november 2026) med status i prototypen och vad som behöver göras i Claude Code-versionen.

Prototypen finns som publicerad artefakt på claude.ai: https://claude.ai/artifact/XDNiFCeeVQrZW5fE3ei79T
Koden ligger i `index.html`, `css/` och `js/` (HTML, CSS och JavaScript med `<canvas>`, inget ramverk).

| # | Krav | Status i prototypen | Att göra i Claude Code |
|---|---|---|---|
| 1 | Välja antal spelare, 3–6 | Klart | – |
| 2 | Välja antal kroppsdelar | Klart, 3–6 delar | – |
| 3 | Spela i rummet (samma mobil) eller online | Klart | Online behöver ny backend, se nedan |
| 4 | I rummet kan man skriva in deltagarnas namn | Klart, valfritt. Annars Spelare 1, 2 … | – |
| 5 | Strikt ordning eller slumpad ordning | Klart. Fler delar än spelare ger flera varv | – |
| 6 | Uppifrån och ned eller vänster till höger (häst, bil) | Klart. Egna deluppsättningar för sidled | – |
| 7 | Palett per deltagare, fingret är penseln | Klart. 12 färger plus egen färg, minns valet per spelare | – |
| 8 | Tjocklek från penna till pensel | Klart, reglage 1–48 | – |
| 9 | Online: gubben bor mitt emellan deltagarna, på land | Löst med stadslista, se beslut nedan | Kan byta till GPS och riktig landkontroll |
| 10 | Avtäckning i rök och konfetti med fanfar, som i Sikta mot stjärnorna | Klart. Strålkastare, rök, trumvirvel, fanfar, konfetti | – |
| 11 | Galleri filtrerbart på stad, land, världsdel och väder | Klart utom väder | Lägg till väder via backend |
| 12 | Kategori där man ritar en Äventyrare ur minnet efter 5 sekunder | Klart, men bilderna laddas upp i appen | Se beslut nedan |
| 13 | Tjänsten ger gubben ett namn utifrån en snabbtolkning | Klart via Claude, går att ändra | Flytta till `/api/describe` |
| 14 | Flera språk: svenska, engelska, franska, spanska, tyska | Klart. Varje enhet väljer eget språk | Lägg till fler språk i samma ordbok |
| 15 | Tryckbar SVG av gubben | Inte byggt, men förberett | Penndragen sparas redan som vektorer |

## Beslut och avvägningar

**Plats (krav 9).** En publicerad artefakt kan inte läsa GPS. Varje spelare väljer i stället stad ur en lista med cirka 140 städer. Appen räknar ut mittpunkten på jordklotet och flyttar gubben till närmaste stad i listan. Eftersom alla städer ligger på land hamnar gubben alltid på land. Listan innehåller medvetet några ensliga platser (Azorerna, Nuuk, Honolulu, Timbuktu) så att mittpunkter över hav blir roliga. I en egen webbapp går det att använda `navigator.geolocation` och en riktig land/hav-karta i stället.

**Väder (krav 11).** En publicerad artefakt får inte hämta data från andra webbplatser, så väder saknas. Med en egen backend kan vädret hämtas från en väder-API när gubben skapas, eller live när galleriet visas.

**Äventyrare-ansikten (krav 12).** Bilderna på https://www.aventyret.se/kontakt#employees kunde inte hämtas, och en artefakt får inte visa bilder från andra domäner. I prototypen laddar den som har redigeringsrätt upp foto och förnamn under *Äventyrare-ansikten*. Den som ritar huvudet ser ansiktet i 5 sekunder med nedräkning. Namnet blir till exempel "Joel som häst" och kan ändras. **Fråga kollegorna innan deras ansikten används.**

**Musik (krav 10).** Fanfaren och trumvirveln är syntetiserade i koden (Web Audio). Musiken från Sikta mot stjärnorna är upphovsrättsskyddad och används inte.

**Namn på appen.** Prototypen heter "Vikgubbar" i gränssnittet. Enligt `beslut.md` heter spelet **Party** (Part✌️). Byt rubriken och lägg in loggan när koden flyttas till repot.

## Det här måste bytas ut när prototypen blir en egen app

Prototypen använder funktioner som bara finns i publicerade artefakter på claude.ai. De anropas via `window.claude.use(...)`.

| Prototypen använder | Används till | Ersätt med |
|---|---|---|
| `claude.use("db")` | Onlinespel, galleri, ansiktslista | En databas med realtid, till exempel Supabase eller Firebase |
| `claude.use("user")` | Vem som spelar online och deras namn | Inloggning, eller bara ett namn som spelaren skriver in |
| `claude.use("sample")` | Claude tittar på bilden och hittar på ett namn | Serverlös funktion `/api/describe` som anropar Claude med `ANTHROPIC_API_KEY` |
| `claude.use("assets")` | Uppladdade ansiktsbilder | Lagring i samma tjänst som databasen |

Allt annat (ritytan, verktygen, vikningen, avtäckningen, ljudet, språken, stadslistan) är vanlig JavaScript och kan följa med som det är. Läget "i rummet" fungerar redan utan backend om man öppnar `index.html` direkt i webbläsaren.

## Kvar att ändra i prototypen

- Byt "Vikgubbar" mot Party och lägg in loggan från `assets/`.
- Byt typsnittet Inter Tight mot Hanken Grotesk, enligt designriktlinjerna.
