# WLKY

Installeerbare webapp (PWA): walkietalkie met meerdere kanalen en meerdere mensen per kanaal.

- **Tik op het scherm**: menu met je naam en kanalen (toevoegen, delen via link, verwijderen).
- **− / +**: wissel van kanaal. Je luistert altijd naar alle kanalen tegelijk.
- **PTT**: ingedrukt houden. Praat er al iemand, dan kom je in de wachtrij en hoor je een piepje als je aan de beurt bent. Ben je alleen in het kanaal, dan stuurt PTT een oproep-melding.

## Hoe werkt het
- Elk kanaal is een Cloudflare Durable Object (`src/api.js`, class `Channel`) dat bepaalt wie er aan de beurt is (max. 60 s per beurt) en het geluid doorstuurt.
- Het geluid wordt in de app versleuteld (AES-GCM) met een sleutel uit de kanaalcode. Namen gaan ook versleuteld mee. De server ziet alleen een hash van de code en versleutelde data. Max. 10 personen per kanaal.
- Oproep-meldingen via Web Push; abonnementen staan in KV (`WALKIE`).

## Hosting op Cloudflare Workers
Workers & Pages → Import repository → deze repo, deploy command `npx wrangler deploy`. Domein en bindings staan in `wrangler.jsonc`.

## Android-app (APK)
`android/` is een kleine Kotlin-app die de webapp (`public/`) meelevert in een WebView. Extra: **offline modus**
(menu → Verbinding: **Auto** zoekt telefoons in de buurt en valt terug op internet, **Internet** of **Offline**) via Google Nearby Connections, zonder internet.
GitHub Actions bouwt bij elke push de APK en zet hem in de release `latest`:
https://github.com/Jeroentjj/Walkietalkie/releases/latest/download/wlky.apk

### Signeersleutel
De APK wordt altijd met dezelfde sleutel gesigneerd, zodat updates over de vorige versie heen installeren.
De sleutel staat **niet** in de repo maar in de GitHub-secrets `KEYSTORE_B64` (base64 van de .jks) en
`KEYSTORE_PASSWORD`. Bewaar een kopie van de .jks veilig: zonder die sleutel kun je geen updates meer uitbrengen.

## Beveiliging
- Kanaalcodes zijn 128 bits willekeurig; de AES-256-GCM-sleutel en de kanaal-id worden daaruit afgeleid.
  Oude, korte codes (van vóór deze versie) worden als onveilig gemarkeerd.
- Server ziet: kanaal-hash, IP-adressen, tijdstippen en hoeveelheid data. Niet: code, geluid, chat of namen.
- Iedereen met de link is lid; er is geen forward secrecy. Lekt een link, maak dan een nieuw kanaal.

`tools/sleutelmaker.html` maakt zo'n sleutel offline in je browser (PKCS#12, alias `walkie`) en geeft direct de
waarde voor `KEYSTORE_B64`. Gebruikt node-forge (BSD).

## Geluid
Een geluidsframe is ~128 ms, 8-bit µ-law, AES-256-GCM versleuteld: `[0x02][IV 12 bytes][ciphertext]`. Dat is ~8 berichten per seconde
en ~16 kB/s (was ~23/s en ~32 kB/s). Ontvangers negeren andere frameversies, dus alle telefoons moeten de nieuwe versie hebben.

## Versies
De webapp is een proefversie; de Android-app (Play Store) is het volledige product. De **server** dwingt de grenzen af (`src/tiers.js`, `src/quota.js`); `TIERS` in `public/index.html` heeft dezelfde getallen alleen om ze uit te leggen.

| | Web | Basis (gratis app) | Plus (€1,99 eenmalig) | Pro (€4,99 eenmalig) |
|---|---|---|---|---|
| Kanalen | 1 | 3 | 10 | 25 |
| Audioberichten per dag | 25 | 100 | onbeperkt | onbeperkt |
| Per keer praten | 20 s | 60 s | 60 s | 60 s |
| Chat per dag | alleen lezen | 5 | 50 | onbeperkt |
| Zonder internet (QR / in de buurt) | nee | ja | ja | ja |
| Volledige webapp op extra apparaten | – | – | 1 | 3 |

Plus en Pro koop je in de app (Google Play, producten `wlky_plus` en `wlky_pro`). De server controleert de aankoop bij Google
(`src/license.js`) en geeft een ondertekende licentie. Met **Versies → Koppel een apparaat** krijg je een eenmalige link (10 min)
waarmee de webapp op een laptop of tablet dezelfde versie krijgt; bij te veel apparaten valt het oudste af.
Per verbinding bepaalt de server de versie: zonder geldige licentie = web; de gratis app krijgt Basis alleen met een
Play Integrity-bewijs (echt uit Google Play, niet aangepast); Plus/Pro via de aankooplicentie. Tellers per apparaat staan in
de Durable Object `Quota`; voor de webversie geldt daarnaast een gezamenlijk maximum per IP-adres (`WEB_PER_IP`), zodat
opslag wissen niet helpt. Uitzondering: de QR-koppeling is een directe verbinding zonder server en valt daarbuiten.

"Haal de app"-knoppen gaan naar `https://wlky.app/app`, dat doorstuurt naar de Play Store (`PLAY_URL` in `src/api.js`).
De manifest-velden `related_applications` en `prefer_related_applications` laten Chrome op Android de Play Store-app aanbieden in plaats van de webapp.

## Privé-beta
Een link `https://wlky.app/#beta=<code>` geeft testers alles onbeperkt (Pro-grenzen), ook in de webapp, tot `BETA_UNTIL`
(`wrangler.jsonc`), voor maximaal `BETA_MAX` apparaten. De code is het Cloudflare-geheim `BETA_CODE`; verwijder dat
geheim om de beta direct te stoppen. Na de einddatum vallen testers terug op hun normale versie.
