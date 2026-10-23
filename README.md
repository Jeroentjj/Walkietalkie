# Walkie

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
(menu → "Offline: via Bluetooth/wifi in de buurt") via Google Nearby Connections, zonder internet.
GitHub Actions bouwt bij elke push de APK en zet hem in de release `latest`:
https://github.com/Jeroentjj/Walkietalkie/releases/latest/download/walkie.apk

### Signeersleutel
De APK wordt altijd met dezelfde sleutel gesigneerd, zodat updates over de vorige versie heen installeren.
De sleutel staat **niet** in de repo maar in de GitHub-secrets `KEYSTORE_B64` (base64 van de .jks) en
`KEYSTORE_PASSWORD`. Bewaar een kopie van de .jks veilig: zonder die sleutel kun je geen updates meer uitbrengen.

## Beveiliging
- Kanaalcodes zijn 128 bits willekeurig; de AES-256-GCM-sleutel en de kanaal-id worden daaruit afgeleid.
  Oude, korte codes (van vóór deze versie) worden als onveilig gemarkeerd.
- Server ziet: kanaal-hash, IP-adressen, tijdstippen en hoeveelheid data. Niet: code, geluid, chat of namen.
- Iedereen met de link is lid; er is geen forward secrecy. Lekt een link, maak dan een nieuw kanaal.
