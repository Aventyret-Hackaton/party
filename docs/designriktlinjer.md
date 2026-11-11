# Designriktlinjer för spelet

Destillerat ur CSS:en från Äventyrets webbplats [www.aventyret.se](https://www.aventyret.se). Det här är det vi tar med oss till appen. Resten av CSS:en (WordPress-block, cookie-dialog, sidfot, meny) är inte relevant för spelet.

## Färger

Accentfärgen är Äventyrets orangeröda. Värdena är avlästa direkt från aventyret.se (startsidan, `body.aventyret`). Varianten `-text` är mörkare för att klara kontrastkraven när accenten används som text på vit botten.

```css
:root {
  --accent-1: #e2481e;            /* accent: ytor, ramar, stora rubriker */
  --accent-1-text: #c43c14;       /* accent som brödtext och länkar */
  --accent-1-text-hover: #9e2f0f; /* hover på länkar */
  --accent-1-muted: #e86d4b;      /* accent på mörk botten */

  --ink: #222;          /* brödtext */
  --black: #000;        /* rubriker på ljus botten */
  --paper: #fff;        /* standardbakgrund */
  --muted: #eeeeed;     /* dämpad yta, hover på knappar */
  --sand: #e3e1db;      /* alternativ dämpad ton */
  --grey-line: #ccc;    /* tunna avdelare */
  --grey-text: #4d4d4d; /* finstilt */

  --night: #100e16;     /* inverterad bakgrund */
  --gold: #c19c61;      /* rubriker på mörk botten */
  --bronze: #8a6a35;    /* hover och copyright i ljus sidfot */
  --umber: #18130c;     /* overlay, multiply 0.1–0.85 */
  --on-night: #ffffffa6;/* brödtext på mörk botten */
}
```

Tre färgteman återkommer: **default** (vitt, svart rubrik), **muted** (#eeeeed) och **inverted** (#100e16 med guldrubriker och 65 % vit text). Ett fjärde tema är helt accentfärgat med vita rubriker.

## Typsnitt

**Beslut:** appen använder öppna typsnitt från Google Fonts som liknar Äventyrets licensierade typsnitt. Originalen (Replica LL och Blankenhorn LL) laddas bara på Äventyrets egen domän och används inte.

| Roll | Äventyret använder | Vi använder | Varför |
|---|---|---|---|
| Grundtypsnitt, rubriker och brödtext | Replica LL (Light, Regular, Bold, Italic) | **Hanken Grotesk** (300, 400, 700 + kursiv) | Neutral, lätt geometrisk grotesk med en riktig Light-vikt, som Replica. |
| Handskrift, "chatty" och stora tal | Blankenhorn LL Script | **Caveat Brush** | Ledig penselhandstil med samma tuschpenna-känsla. |

Båda har stöd för å, ä och ö.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat+Brush&family=Hanken+Grotesk:ital,wght@0,300;0,400;0,700;1,400&display=swap" rel="stylesheet">
```

```css
:root {
  --font-sans: "Hanken Grotesk", system-ui, sans-serif;
  --font-script: "Caveat Brush", "Comic Sans MS", cursive;
}
body   { font-family: var(--font-sans); font-weight: 400; }
h1, h2, h3 { font-family: var(--font-sans); font-weight: 300; }
strong { font-weight: 700; }
.chatty, .display-number { font-family: var(--font-script); font-weight: 400; color: var(--accent-1); }
```

Principen från förlagan gäller: rubriker sätts i **Light (300)**, inte Bold. Handskriften används sparsamt till utrop, instruktioner, stora tal och små "psst"-inslag. Den passar ett ritspel perfekt.

## Typografisk skala

Mobil först med ett steg upp vid 45rem.

| Roll | Mobil | ≥ 45rem | Typsnitt |
|---|---|---|---|
| Liten text / knappar | 0.9375rem / 1.3125 | 1.125rem / 1.5 | Hanken Grotesk 400 |
| Brödtext | 1.125rem / 1.5 | 1.3125rem / 1.875 | Hanken Grotesk 400 |
| Ingress | 1.3125rem / 1.875 | 1.6875rem / 2.25 | Hanken Grotesk 400 |
| H3 | 1.875rem / 2.25 | – | Hanken Grotesk 300 |
| H1/H2 | 2.25rem / 2.625 | 2.625rem / 3 | Hanken Grotesk 300 |
| Jätterubrik | 2.625rem / 3.375 | 4.5rem / 5.25 | Hanken Grotesk 300 |
| Chatty | 3.375rem / 3.375 | 4.5rem (≥ 67.5rem) | Caveat Brush, accentfärg |
| Display-tal | clamp(9rem, 24vw, 13.5rem) | – | Caveat Brush, accentfärg |

Minimal spärrning: 0.0025–0.005em på små grader, 0 på större.

## Komponenter och detaljer att låna

- **Knapp:** pillerform (`border-radius: 2.25rem`), `padding: 1.125rem 1.875rem`, vit bakgrund, 1px ram och text i accentfärg. Hover ger #eeeeed. Sekundär knapp har #222 i stället för accent. Disabled ger opacity 0.5.
- **Avfasade hörn:** bilder, logoramar och formulärfält har `clip-path` med 8px (fält 4px) avfasning i stället för rundade hörn. Bra signatur för ritytan och för vikdelarna.
- **Etikett med linje:** liten text följd av en 1px linje i accentfärg som fyller ut raden. Passar som rubrik per vikdel ("Huvud", "Kropp", "Ben").
- **Punktlistor:** små romber (kvadrat roterad 45°) i stället för prickar.
- **Länkar med pil:** fristående länkar får " →" efter sig och understrykning först vid hover.
- **Fokusmarkering:** 2px svart outline med 2px offset och vit ring utanför.
- **Overlay:** #18130c med `mix-blend-mode: multiply` på bilder, 0.1 i vila och ner mot 0 vid hover.
- **Toggle:** 3.75 × 2rem, grå i av-läge och accentfärgad med vit knopp i på-läge.

## Rörelse

- Element glider in 4.375rem nerifrån och tonas upp på 0.5s med 0.35s fördröjning.
- Ord och logotyper avslöjas från blur(4–8px) och låg opacitet till skarpt. Kan användas när vikgubben vecklas ut.
- Bakgrunden kan tona mellan teman (vitt, sand, natt) på 0.5s.
- Allt respekterar `prefers-reduced-motion`.

## Layout

- Rutnät med 4, 6 och 12 kolumner, spaltmellanrum 1.125rem respektive 1.875rem.
- Brytpunkter: 27.5rem, 45rem, 67.5rem, 80rem, 87.5rem.
- Sidmarginal 1.125rem, 4.5rem och 6rem. Maxbredd 92rem.
- Generös luft: 3.75rem sektionsmarginal på mobil, 6rem på stor skärm. Textspalt högst cirka 37rem.

## Översättning till spelet

En ljus pappersyta (#fff) som rityta, tunt grå vikveck (#ccc) mellan delarna och avfasade hörn på "pappret". Pennan ritar i #222 som standard med accentfärgen #e2481e som andrahandsval. Instruktioner och "Vik!" i Caveat Brush, resten i Hanken Grotesk Light. Avtäckningen av den färdiga gubben kan ske på en mörk natt-yta (#100e16) med guldtext, så att den känns som ett ögonblick.
