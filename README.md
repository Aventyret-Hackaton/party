<p align="center"><img src="assets/party-logo.svg" alt="Party" width="420"></p>

# Party – Fold & draw

*Draw badly, together.*

Vikgubbar i mobilen. Tre spelare turas om att rita huvud, överkropp och ben på skärmen utan att se varandras delar. Sedan vecklas gubben ut, och en AI ger den ett namn och en helt onödig faktaruta.

Byggt under Äventyrets Stupid hackathon av grupp 7. Målet var att göra något helt onödigt med AI, och den tilldelade tekniken var Canvas – användaren ritar på skärmen.

## Status

Under utveckling. Spelet byggs med [Claude Code](https://claude.com/claude-code).

## Innehåll

| Mapp | Vad |
|---|---|
| `index.html` | Spelet – öppna i webbläsaren |
| `css/` | Utseendet |
| `js/` | Koden, en fil per del av spelet |
| `docs/` | Spelregler, designriktlinjer, beslut och utvecklingsplan |
| `assets/` | Loggan i tre varianter, favikonen och mappen `ansikten/` för Äventyrare-ansikten |
| `tools/` | Skriptet som ritar loggan |
| `server.js` | Servern på Heroku: visar spelet och sparar det gemensamma galleriet, se docs/heroku.md |
| `CLAUDE.md` | Instruktioner till Claude Code |

## Licens

Koden är släppt under MIT-licensen, se [LICENSE](LICENSE). Typsnittet Caveat Brush, som loggan bygger på, är licensierat under SIL Open Font License.
