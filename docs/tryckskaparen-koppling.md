# Koppling från Party: trycka en vikgubbe på en tröja

Det här dokumentet beskriver vad Tryckskaparen behöver för att ta emot en teckning från spelet **Party** och visa den på teckningssidan (`#/teckning`), redo att tryckas.

## Bakgrund

Party är ett vikgubbespel på webben. Tre till sex spelare ritar varsin del av en figur på en canvas utan att se varandras delar. Sedan vecklas gubben ut och presenteras. Där ska det finnas en knapp, **Tryck på tröja**, som öppnar Tryckskaparen med gubben redan inläst.

Party sparar varje penndrag som vektorer (färg, tjocklek, punkter). Därför kan Party lämna ut gubben som en ren SVG med vit bakgrund, utan skuggor, papperskanter eller brus.

## Hur det ska fungera

1. Spelaren trycker på **Tryck på tröja** i Party.
2. Party öppnar en ny flik med den här adressen:

   ```
   https://tryckskaparen.tifosi.se/#/teckning?bild=<url-kodad adress till SVG:n>
   ```

   Till exempel:

   ```
   https://tryckskaparen.tifosi.se/#/teckning?bild=https%3A%2F%2Fparty-fold-draw-caa6e6b2ffe4.herokuapp.com%2Fapi%2Fgallery%2F123.svg
   ```

3. Tryckskaparen läser `bild`, hämtar SVG:n från Party och behandlar den som om användaren hade laddat upp ett foto.
4. Användaren väljer färger, storlek och tröjfärg som vanligt och laddar ned tryckfilen.

> Party ligger på https://party-fold-draw-caa6e6b2ffe4.herokuapp.com/.

Teckningssidan matchar redan `#/teckning?bild=...`, eftersom routern bara läser det som står före `?`. Det som behövs är att läsa parametern och ladda in bilden.

## Det Party levererar

| | |
|---|---|
| Adress | `https://party-fold-draw-caa6e6b2ffe4.herokuapp.com/api/gallery/<id>.svg`, där `<id>` är ett heltal |
| Metod | `GET`, ingen inloggning |
| Content-Type | `image/svg+xml; charset=utf-8` |
| CORS | `Access-Control-Allow-Origin: https://tryckskaparen.tifosi.se` |
| Storlek | Normalt under 300 kB |

Om SVG:n:

- Den har en vit bakgrund som täcker hela bilden. Papperet räknas alltså som vitt.
- Penndragen är `<path>` med `stroke`, rundade ändar och hexfärger, till exempel `#222222` eller `#e2481e`.
- Det spelaren har suddat ritas som **vita** streck. De försvinner tillsammans med papperet när Tryckskaparen tar bort vitt.
- `viewBox` är i Partys egna enheter. En stående gubbe med tre delar är ungefär 600 × 940 enheter. En liggande gubbe är bredare än den är hög.
- SVG:n innehåller inga skript, länkar, typsnitt eller externa bilder.

## Det Tryckskaparen behöver bygga

### 1. Läsa parametern

På teckningssidan, när sidan laddas och när adressen ändras:

```js
const query = window.location.hash.split("?")[1] || "";
const bild = new URLSearchParams(query).get("bild");
```

### 2. Bara tillåta bilder från Party

Hämta bara om alla villkor stämmer. Annars kan vem som helst skicka länkar som laddar in godtyckliga bilder via Tryckskaparen.

```js
function partyBildOk(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:"
      && u.hostname === "party-fold-draw-caa6e6b2ffe4.herokuapp.com"
      && /^\/api\/gallery\/\d+\.svg$/.test(u.pathname);
  } catch (e) {
    return false;
  }
}
```

### 3. Hämta och göra om till en bild

- Hämta med `fetch(url, { credentials: "omit" })`.
- Kontrollera att svaret är `ok`, att `Content-Type` börjar med `image/svg+xml` och att storleken är rimlig, till exempel under 2 MB.
- Lägg **aldrig** in SVG:n i sidan med `innerHTML` eller liknande. Rita den bara som bild. Då körs inget som eventuellt finns i filen.

```js
const svgText = await res.text();
const blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
const img = new Image();
img.src = blobUrl;
await img.decode();

// Rita i hög upplösning på vitt, så att trycket blir skarpt
const width = 3000;
const height = Math.round(width * img.naturalHeight / img.naturalWidth);
const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#fff";
ctx.fillRect(0, 0, width, height);
ctx.drawImage(img, 0, 0, width, height);
URL.revokeObjectURL(blobUrl);

const png = await new Promise(ok => canvas.toBlob(ok, "image/png"));
const file = new File([png], "party-vikgubbe.png", { type: "image/png" });
// Skicka file till samma funktion som tar emot en uppladdning
```

Om SVG:n saknar `width` och `height` kan `naturalWidth` bli 0 i vissa webbläsare. Läs då måtten från `viewBox`. Party lägger in både `width`, `height` och `viewBox`.

### 4. Visa vad som händer

- Medan bilden hämtas: en kort text, till exempel "Hämtar gubben från Party …".
- Om det inte går: "Det gick inte att hämta teckningen från Party. Ladda upp den som en bild i stället." Visa sedan den vanliga uppladdningen.
- Gärna en rad som säger att teckningen kommer från Party.

### 5. Gärna: läge för digitala teckningar

Party-teckningar är redan rena. Funktionerna som är gjorda för foton behövs inte och kan i värsta fall ta bort tunna streck:

- borttagning av små prickar och fläckar
- skuggor från papperet
- vridning

Ett förslag är att sätta de här inställningarna automatiskt när bilden kommer från Party, men låta användaren ändra dem.

## Färger

I Party kan man rita med tolv färger och dessutom välja egna. En gubbe har ofta tre till sex färger. Tryckskaparens förslag med 16 färger eller färre fungerar, men eftersom varje tryckfärg brukar kosta kan det vara bra att föreslå färre färger för Party-teckningar.

## Att testa innan Party är klart

Spara det här som en fil, lägg ut den på en adress som ni själva tillåter tillfälligt och öppna `#/teckning?bild=...` mot den:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <rect width="600" height="600" fill="#ffffff"/>
  <path d="M300 80 C380 80 420 140 420 200 C420 270 370 320 300 320 C230 320 180 270 180 200 C180 140 220 80 300 80"
        fill="none" stroke="#222222" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M300 320 L300 470 M300 380 L210 430 M300 380 L390 430 M300 470 L230 570 M300 470 L370 570"
        fill="none" stroke="#e2481e" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

Kontrollera att:

- gubben visas på tröjan utan vit ruta runt sig
- både den svarta och den röda färgen finns med i trycket
- en adress från en annan domän inte laddas in
- en trasig adress ger felmeddelandet och den vanliga uppladdningen

## Öppna frågor

- **Beställning:** Tryckskaparen slutar i dag med att man laddar ned tryckfilen. Hur ska en Party-spelare beställa tröjan?
- **Rättigheter:** Tryckskaparen ber användaren intyga att hen har rätt att använda teckningen. En Party-gubbe är ritad av flera personer. Räcker samma text?
- **Partys adress:** Ska bara Heroku-adressen tillåtas, eller kommer Party att få en egen domän?

## Kontakt

Party byggs av grupp 7 på Äventyrets Stupid hackathon. Repo: https://github.com/Aventyret-Hackaton/party
