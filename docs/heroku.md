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
| `PUT /api/gallery/:id/voice` | Sparar gubbens catchphrase (ljud, högst 300 kB). Kräver nyckeln i `X-Token`. Ljudet ligger i tabellen `gallery_voice` |
| `GET /api/gallery/:id/voice` | Spelar upp catchphrasen |

Nyckeln sparas i webbläsaren (`localStorage`). Servern kontrollerar allt som skickas in och tillåter högst 40 nya gubbar i timmen per IP-adress.

## Onlinespel

Onlinespelet sköts av `online-server.js`, inte längre av claude.ai. Man väljer **Online** under *Var spelar ni?* och ser då en lista med öppna omgångar. Man kan gå med i en omgång eller starta en egen. En omgång startar automatiskt när alla platser är fyllda. Spelet frågar servern om läget varannan sekund.

När gubben är ritad vecklar värden ut den och väljer **Spara** (med namnet i rutan) eller **Radera**. De andra väntar under tiden. Sparas gubben får alla se den, raderas den får de andra bara veta det.

Var spelarna är tar spelet reda på genom att be webbläsaren om platsen. Säger man nej bor gubben på Påskön för den spelaren.

- Omgångarna ligger bara i serverns minne. Vid en deploy eller omstart avbryts de omgångar som pågår just då.
- En spelare som stänger sidan i väntrummet tas bort efter 25 sekunder. Stänger värden sidan försvinner omgången.
- Gamla omgångar städas bort efter tre timmar.

### Samma version för alla

Servern bestämmer vilka delar en omgång har, så att alla spelare ser samma delnamn. Varje svar från servern har också en versionskod (`X-App-Version`, en kontrollsumma av koden). Har en telefon en äldre version öppen än servern, till exempel efter en deploy, visas en röd rad högst upp med knappen Ladda om.

### Spela igen

När gubben är sparad eller raderad finns knappen **Spela igen!**. Den som trycker först startar en ny omgång med samma inställningar och blir värd. De andra ser att en ny omgång har startat och hamnar i samma omgång när de trycker.

### Om någon lämnar mitt i

En spelare räknas som borta om den lämnar omgången (stänger sidan eller trycker Lämna), eller om det är dess tur och den inte hörs av på 90 sekunder (5 minuter med push-notiser på). Har den spelaren delar kvar att rita pausas omgången, och alla får veta vem som har lämnat. Den som håller på att rita sin del får rita klart först. Värden väljer sedan:

- **Rita klart själva** – delarna fördelas på de som är kvar, helst inte samma person två delar i rad.
- **Vänta på en ny spelare** – omgången syns i listan under Gå med i omgång, och den som går med tar över delarna.
- **Avsluta omgången** – omgången tar slut för alla.

Alla andra kan lämna omgången själva. Går värden, eller hörs inte av på 90 sekunder när den ska bestämma något, tar den spelare som senast hördes av över som värd. Kommer en spelare som bara var borta en stund tillbaka innan någon har tagit över, fortsätter omgången som vanligt.

### Lösenord

Onlinespelet kräver ett lösenord. **Skriv aldrig lösenordet i koden eller i repot**, eftersom repot är publikt.

1. Öppna appen på dashboard.heroku.com och gå till fliken **Settings**.
2. Klicka på **Reveal Config Vars**.
3. Lägg till nyckeln `ONLINE_PASSWORD` med lösenordet som värde och klicka på **Add**.

Spelarna skriver lösenordet en gång, sedan minns webbläsaren det. Utan `ONLINE_PASSWORD` behövs inget lösenord.

### Notiser

Under **Online** i Nytt spel finns knappen **Tillåt notiser**. Den som tillåter notiser får en notis när omgången är full och när gubben är klar att kolla på.

- **Push från servern** (`push-server.js`): servern skickar notisen via Google, Apple, Mozilla eller Microsoft, så den kommer fram även när spelet ligger i bakgrunden eller telefonen är låst. Telefonen anmäler sig med `POST /api/games/:id/push` när spelaren går in i en omgång. Notis-hjälpen `js/sw.js` tar emot pushen och visar notisen.
- **iPhone** kan bara få notiser om Party ligger på hemskärmen (Dela → Lägg till på hemskärmen) och öppnas därifrån. Det kräver iOS 16.4 eller nyare. `assets/manifest.webmanifest` gör att Party öppnas som en egen app.
- Spelare med push får vara borta från väntrummet i 15 minuter i stället för 25 sekunder, eftersom en iPhone i bakgrunden inte hörs av.
- Går push inte, till exempel i en webbläsare som saknar det, visas en vanlig notis medan Party är öppet.

**Nycklar (VAPID):** servern skapar ett nytt nyckelpar vid varje start. Det räcker, eftersom omgångarna ändå försvinner vid en omstart. Vill man ha samma nycklar hela tiden kan man lägga in `VAPID_PUBLIC_KEY` och `VAPID_PRIVATE_KEY` under **Config Vars**. **Den privata nyckeln får aldrig hamna i koden eller i repot.**

### Party i närheten

På startskärmen kan man få en inbjudan: **"Signe undrar: Vill du komma på mitt party?"** Svarar man **Ja!** hamnar man direkt i väntrummet. Logiken i spelet ligger i `js/narhet.js`.

Party hittar omgångar i närheten på tre sätt:

1. **Samma nätverk.** Servern jämför spelarnas IP-adresser (`nara-server.js`). Det sker av sig själv på startskärmen och kräver inget tillstånd. IP-adressen sparas bara som en hash med ett salt som byts vid varje omstart.
2. **Plats.** Har både värden och den som letar delat sin plats räknas omgångar inom 250 meter. Platsen sparas bara i minnet medan omgången är öppen och lämnas aldrig ut.
3. **Ultraljud** (`js/ultraljud.js`). I väntrummet trycker man **📢 Ropa ut inbjudan**. Telefonen spelar då omgångens kod med toner mellan 17 och 20 kHz, som är för ljusa för att höras. Knappen som lyssnade efter koden med mikrofonen (**Hitta party i närheten**) är borttagen från startskärmen, så just nu finns inget i spelet som tar emot ropet. Koden för att lyssna finns kvar i `js/ultraljud.js`.

Adressen är `POST /api/games/nearby` med `{ loc: { lat, lon, acc } }`. Platsen skickas i en POST och aldrig i adressen. Svaret innehåller bara omgångens kod, värdens namn och hur den hittades.

Bra att veta:

- På mobilnät delar många telefoner samma IP-adress. Då kan någon längre bort räknas som "samma nätverk". Det är ofarligt, eftersom listan med öppna omgångar ändå är öppen för alla.
- Ultraljudet fungerar olika bra på olika telefoner, beroende på högtalare och mikrofon. Det kräver att den som letar tillåter mikrofonen.
- Är man mitt i en omgång sparas inbjudan och visas först när omgången är klar, när gubben har visats och knapparna syns på scenen. Den egna omgången räknas aldrig som en inbjudan.
- Inget nytt behöver ställas in på Heroku.

## Kartvyn

Galleriets karta använder Leaflet (från cdnjs) och kartbilder från OpenStreetMap. Gubbarna placeras i staden de bor i, med koordinaterna i `js/stader.js`. Ingen nyckel behövs.

## Köra servern på den egna datorn

Det behövs inte för att spela, men för att testa galleriet lokalt:

```bash
PORT=5173 node server.js
```

Öppna sedan http://localhost:5173. Utan `DATABASE_URL` sparas galleriet bara i minnet.

## Adminläget

I galleriet finns längst ned länken **Logga in som admin**. Som admin kan man byta namn på och radera gubbar och gruppbilder. Det som raderas försvinner ur databasen för alltid, med catchphrase och allt.

Det finns ett enda adminkonto. Det ställs in med två config vars på Heroku (Settings → Config Vars):

- `ADMIN_USER` – användarnamnet
- `ADMIN_HASH` – lösenordet, hashat med scrypt. Själva lösenordet sparas aldrig någonstans på servern.

Nytt lösenord: kör `node tools/admin-hash.js` (eller be Claude göra det). Skriptet slumpar ett starkt lösenord och skriver ut hashen. Lägg hashen i `ADMIN_HASH` och spara lösenordet i en lösenordshanterare. Skriv aldrig lösenordet eller hashen i repot.
