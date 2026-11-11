# Canvas – en enkel förklaring

HTML canvas är en tom målarduk på en webbsida. Själva duken skapas med en HTML-tagg, och sedan målar man på den med JavaScript.

## Grunderna

```html
<canvas id="minDuk" width="400" height="300"></canvas>
```

```javascript
const duk = document.getElementById("minDuk");
const ctx = duk.getContext("2d");   // "penseln"

ctx.fillStyle = "blue";
ctx.fillRect(50, 50, 100, 80);      // en blå rektangel

ctx.beginPath();
ctx.arc(250, 120, 40, 0, Math.PI * 2);
ctx.fillStyle = "orange";
ctx.fill();                          // en orange cirkel
```

- **Koordinater:** punkten (0, 0) ligger i övre vänstra hörnet. X ökar åt höger och Y ökar nedåt.
- **Canvas minns inte vad den ritat.** En ritad cirkel är bara pixlar. Animationer görs genom att sudda och rita om bilden många gånger per sekund.
- **Två storlekar:** hur stor duken visas (CSS) och hur många pixlar den har. På mobilen multipliceras pixlarna med `devicePixelRatio`, annars blir strecken suddiga.

## Så använder prototypen canvas

- **Varje del har en egen logisk yta**, 600 × 340 punkter uppifrån och ned eller 340 × 600 i sidled. Fingret räknas om från skärmpixlar till de punkterna.
- **Penndragen sparas som listor av punkter** med färg och tjocklek. Därför går det att ångra, rita om när skärmen vrids, spara i galleriet och senare exportera till SVG.
- **Vikningen:** nästa spelare ser bara en remsa på 40 punkter av förra delen, nedersta kanten eller högra kanten. Det motsvarar stödstrecken som sticker ut över vikningen på papper.
- **Avtäckningen:** alla delar ritas till egna canvas-element som fälls ut en i taget. Rök och konfetti ritas på en separat canvas som ligger över hela skärmen.
- **Pointer events och `touch-action: none`** gör att man kan rita med finger, penna och mus utan att sidan scrollar.
