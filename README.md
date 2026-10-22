# Walkie

Installeerbare webapp (PWA) om met één andere persoon als walkietalkie te praten.

- **+**: kies/maak een geheime kanaalcode en deel die met je partner.
- **PTT** (middelste knop): ingedrukt houden om te praten. Is je partner niet verbonden, dan stuurt PTT een oproep-melding.
- **−**: verbinding verbreken.

## Hoe werkt het
- Audio gaat peer-to-peer via WebRTC, end-to-end versleuteld (DTLS-SRTP). PeerJS regelt alleen het "elkaar vinden".
- Meldingen lopen via een Cloudflare Worker (`src/api.js`) met Web Push. Die bewaart per kanaal alleen een hash en de push-adressen, geen audio.
- Maximaal 2 personen per kanaal. Per telefoon is maar één venster tegelijk actief.

## Hosting op Cloudflare Workers
1. Workers & Pages → Create → Import a repository → deze repo. Deploy command: `npx wrangler deploy`.
2. De KV-opslag `WALKIE` wordt bij de eerste deploy automatisch aangemaakt (zie `wrangler.jsonc`).
3. Custom domain: `walkie.domimo.app`.
