# Walkie

Installeerbare webapp (PWA): walkietalkie met meerdere kanalen en meerdere mensen per kanaal.

- **Tik op het scherm**: menu met je naam en kanalen (toevoegen, delen via link, verwijderen).
- **− / +**: wissel van kanaal. Je luistert altijd naar alle kanalen tegelijk.
- **PTT**: ingedrukt houden. Praat er al iemand, dan kom je in de wachtrij en hoor je een piepje als je aan de beurt bent. Ben je alleen in het kanaal, dan stuurt PTT een oproep-melding.

## Hoe werkt het
- Elk kanaal is een Cloudflare Durable Object (`src/api.js`, class `Channel`) dat bepaalt wie er aan de beurt is (max. 60 s per beurt) en het geluid doorstuurt.
- Het geluid wordt in de app versleuteld (AES-GCM) met een sleutel uit de kanaalcode. De server ziet alleen een hash van de code en versleutelde audio.
- Oproep-meldingen via Web Push; abonnementen staan in KV (`WALKIE`).

## Hosting op Cloudflare Workers
Workers & Pages → Import repository → deze repo, deploy command `npx wrangler deploy`. Domein en bindings staan in `wrangler.jsonc`.
