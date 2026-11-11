# Plan: utveckling, GitHub och hosting

**Beslut:** spelet byggs i Claude Code, koden ligger på GitHub och spelet körs online via en hostingtjänst som publicerar automatiskt från GitHub.

## 1. GitHub

- Repot ligger i organisationen `aventyret-hackaton` och är publikt.
- Inga hemligheter (API-nycklar, `.env`-filer) får committas.

## 2. Claude Code

- Klona repot lokalt och starta Claude Code i repomappen.
- Underlaget finns i `docs/`, loggorna i `assets/`. `CLAUDE.md` i roten säger vad Claude Code ska läsa först.

## 3. Vad som ska byggas (första versionen)

Enkel webbapp: HTML, CSS och JavaScript med `<canvas>`. Inget ramverk behövs.

1. **Alla spelar på samma enhet.** Tre spelare turas om och skickar mobilen eller surfplattan mellan sig.
2. **Varje person ritar en del på ritytan.** Huvud, överkropp och ben. Canvas är själva spelet.
3. **Tidigare delar viks undan.** När en del är klar döljs den, och nästa spelare ser bara stödstrecken som sticker ner över vikningen.
4. **Avtäckning på natt-ytan** (#100e16) med en kort tona-in-animering.
5. **AI:n ger gubben ett namn och en faktaruta.** Den färdiga bilden skickas till Claude, som hittar på ett namn och några onödiga fakta.

Tekniska tips:

- Använd pointer events och `touch-action: none` på canvas, annars scrollar sidan när man ritar på mobilen. Testa i Safari på iPhone.
- Rita i hög upplösning (`devicePixelRatio`) så att strecken inte blir suddiga.
- Typsnitt från Google Fonts: Hanken Grotesk och Caveat Brush (se designriktlinjerna).

## 4. AI-anropet kräver en liten backend

API-nyckeln till Claude får aldrig ligga i koden som skickas till webbläsaren, för då kan vem som helst läsa den. Lägg anropet i en serverlös funktion, till exempel `/api/describe`, och spara nyckeln som en miljövariabel (`ANTHROPIC_API_KEY`) hos hostingtjänsten. Sätt ett kostnadstak på nyckeln, eftersom den publika länken kan användas av vem som helst.

## 5. Hosting

Välj en tjänst som kopplas till GitHub-repot och publicerar automatiskt vid varje push, och som stöder serverlösa funktioner för steg 4. Vercel och Netlify gör båda det. Kontrollera villkoren för gratisnivån innan ni väljer, eftersom vissa begränsar kommersiell användning. GitHub Pages räcker om ni hoppar över AI-funktionen, eftersom den bara kan servera statiska filer.

Varje gren får då en egen förhandsgranskningslänk, vilket är praktiskt när tre personer jobbar samtidigt.

## Reserv inför demon

Om hostingen eller AI-funktionen inte är klar i tid: kör spelet lokalt från en dator, eller bygg en publicerad artefakt i Claude med samma underlag. Det ger en delbar länk direkt.

## Senare

App Store-versionen (namn och undertitel finns i `beslut.md`) kan byggas genom att paketera webbappen, till exempel med Capacitor.
