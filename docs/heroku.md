# Heroku

Spelet körs på Heroku. Heroku bygger om appen automatiskt varje gång något hamnar på `main` på GitHub.

## Vad som körs

- `server.js` – en liten Node-server utan ramverk. Den visar spelet (`index.html`, `css/`, `js/`, `assets/`) och sköter det gemensamma galleriet. Andra filer i repot, som `docs/` och `server.js` själv, visas inte utåt.
- `package.json` – talar om för Heroku att det är en Node-app och att den startas med `node server.js`.
- `Procfile` – `web: npm start`.

## Galleriet

Gubbarna sparas i **Heroku Postgres**. Penndragen sparas som vektorer (färg, tjocklek, punkter), inte som bilder, så att SVG-export (krav 15) går att bygga.

Så lägger man till databasen (en gång):

1. Öppna appen på dashboard.heroku.com och gå till fliken **Resources**.
2. Sök efter **Heroku Postgres** under **Add-ons** och välj den minsta planen (Essential-0, kostar några dollar i månaden).
3. Heroku sätter då miljövariabeln `DATABASE_URL` och startar om appen. Servern skapar tabellen själv.

Utan databas fungerar galleriet ändå, men bara i minnet. Allt försvinner när appen startar om, och det gör den vid varje deploy och minst en gång per dygn.

| Adress | Vad |
|---|---|
| `GET /api/health` | Svarar `{"ok":true,"storage":"postgres"}` eller `"memory"` |
| `GET /api/gallery` | De 150 senaste gubbarna |
| `POST /api/gallery` | Sparar en gubbe. Svarar med `id` och en nyckel (`token`) |
| `PATCH /api/gallery/:id` | Byter namn. Kräver nyckeln, så bara den som sparade gubben kan byta namn |

Nyckeln sparas i webbläsaren (`localStorage`). Servern kontrollerar allt som skickas in och tillåter högst 40 nya gubbar i timmen per IP-adress.

## Kartvyn

Galleriets karta använder Leaflet (från cdnjs) och kartbilder från OpenStreetMap. Gubbarna placeras i staden de bor i, med koordinaterna i `js/stader.js`. Ingen nyckel behövs.

## Köra servern på den egna datorn

Det behövs inte för att spela, men för att testa galleriet lokalt:

```bash
PORT=5173 node server.js
```

Öppna sedan http://localhost:5173. Utan `DATABASE_URL` sparas galleriet bara i minnet.
