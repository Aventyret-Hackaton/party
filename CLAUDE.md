# Party (Part✌️)

Ett onödigt vikgubbespel för Äventyrets Stupid hackathon, grupp 7.
Tilldelad teknik: Canvas – användaren ritar på skärmen. Den måste synas tydligt i lösningen.
Regel: lösningen får inte bli för användbar.

## Läs först
- docs/vikgubbar.md – spelreglerna
- docs/designriktlinjer.md – färger, typsnitt, komponenter. Följ dem.
- docs/beslut.md – namn och logga
- docs/plan-utveckling.md – vad som ska byggas och hur

## Riktlinjer
- Repot är PUBLIKT. Committa aldrig API-nycklar, .env-filer eller andra hemligheter.
- Enkel webbapp: HTML, CSS och JavaScript med <canvas>. Inget ramverk.
- Gränssnittstexter på svenska. Använd tankstreck (–), aldrig em-streck (—).
- Pointer events och touch-action: none på canvas. Testa i Safari på iPhone.
- API-nyckeln till Claude får aldrig hamna i klientkoden. AI-anropet ligger i en serverlös funktion (/api/describe) och nyckeln i miljövariabeln ANTHROPIC_API_KEY.
- Loggor ligger i assets/. Ändra dem inte för hand, använd tools/logo-generator.py.
- Användaren är inte utvecklare. Förklara på enkel svenska vad du gör och varför.
