# Party (Part✌️)

Ett onödigt vikgubbespel för Äventyrets Stupid hackathon, grupp 7.
Tilldelad teknik: Canvas – användaren ritar på skärmen. Den måste synas tydligt i lösningen.
Regel: lösningen får inte bli för användbar.

## Läs först
- docs/krav.md – gruppens 15 krav, status och beslut
- docs/vikgubbar.md – spelreglerna
- docs/designriktlinjer.md – färger, typsnitt, komponenter. Följ dem.
- docs/beslut.md – namn och logga
- docs/plan-utveckling.md – vad som ska byggas och hur
- docs/canvas-forklaring.md – hur canvas fungerar och hur prototypen använder den
- prototyp/index.html – första fungerande versionen, byggd i Claude på claude.ai. Utgå från den.

## Riktlinjer
- Repot är PUBLIKT. Committa aldrig API-nycklar, .env-filer eller andra hemligheter.
- Enkel webbapp: HTML, CSS och JavaScript med <canvas>. Inget ramverk.
- Gränssnittet finns på svenska, engelska, franska, spanska och tyska. Alla texter ligger i ordboken T i koden – lägg aldrig in text utan översättning. Använd tankstreck (–), aldrig em-streck (—).
- Penndrag sparas som vektorer (färg, tjocklek, punkter). Behåll det, så att SVG-export (krav 15) går att bygga.
- Prototypen anropar window.claude.use(...) för databas, inloggning, AI-namn och bilduppladdning. Det finns bara på claude.ai och ska ersättas, se tabellen i docs/krav.md.
- Pointer events och touch-action: none på canvas. Testa i Safari på iPhone.
- API-nyckeln till Claude får aldrig hamna i klientkoden. AI-anropet ligger i en serverlös funktion (/api/describe) och nyckeln i miljövariabeln ANTHROPIC_API_KEY.
- Loggor ligger i assets/. Ändra dem inte för hand, använd tools/logo-generator.py.
- Användaren är inte utvecklare. Förklara på enkel svenska vad du gör och varför.

## Samarbete
Tre personer (Signe, Anna och Joel) jobbar i repot samtidigt, var och en med sin egen Claude Code. Följ de här reglerna:

1. **Hämta senaste först.** Kör `git pull` från main innan du börjar, och påminn användaren om att göra Fetch och Pull i GitHub Desktop.
2. **Jobba aldrig direkt på main.** Om användaren står på main, skapa en egen gren med användarens namn och vad som görs, till exempel `anna-avtackning`.
3. **Håll dig till dina egna filer.** Ändra bara de filer som hör till användarens del. Behöver en gemensam fil (som index.html eller style.css) ändras, gör minsta möjliga ändring och säg till användaren att de andra bör veta om det.
4. **Små commits med tydliga meddelanden på svenska.** Committa ofta, så att det är lätt att slå ihop.
5. **Pusha och be om pull request.** När något fungerar: pusha grenen och förklara för användaren hur man skapar en pull request i GitHub Desktop (Push origin → Create Pull Request).
6. **Vid konflikter:** förklara på enkel svenska vad som krockar och föreslå en lösning. Kasta aldrig bort någon annans ändringar.
