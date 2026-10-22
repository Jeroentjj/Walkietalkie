# Walkie

Installeerbare webapp (PWA) om met één andere persoon als walkietalkie te praten.

- **+**: kies/maak een geheime kanaalcode en deel die met je partner.
- **PTT** (middelste knop): ingedrukt houden om te praten. Is je partner niet verbonden, dan stuurt PTT een oproep-melding.
- **−**: verbinding verbreken.

## Hoe werkt het
- Audio gaat peer-to-peer via WebRTC, end-to-end versleuteld (DTLS-SRTP). PeerJS regelt alleen het "elkaar vinden".
- Meldingen lopen via een Cloudflare Pages Function (`functions/api`) met Web Push. Die bewaart per kanaal alleen een hash en de push-adressen, geen audio.
- Maximaal 2 personen per kanaal. Per telefoon is maar één venster tegelijk actief.

## Hosting op Cloudflare Pages
1. Workers & Pages → Create → Pages → Connect to Git → deze repo. Build command leeg, output directory `/`.
2. Maak een KV-namespace `walkie` en koppel hem aan het project als binding `WALKIE` (Settings → Bindings), daarna opnieuw deployen.
3. Custom domain: `walkie.domimo.app`.
