# Walkie

Installeerbare webapp (PWA) om met één andere persoon als walkietalkie te praten.

- **CH**: kies/maak een geheime kanaalcode en deel die met je partner.
- **PTT** (grote oranje knop): ingedrukt houden om te praten.
- **OFF**: verbinding verbreken.

## Hoe werkt het
- Audio gaat peer-to-peer via WebRTC, standaard end-to-end versleuteld (DTLS-SRTP).
- De gratis PeerJS-server regelt alleen het "elkaar vinden". Die ziet alleen een SHA-256-hash van de kanaalcode, nooit de code of de audio.
- Maximaal 2 personen per kanaal. Per telefoon is maar één venster tegelijk actief.

## Installeren op Android
Host de map via HTTPS (bijv. GitHub Pages), open hem in Chrome en kies **App installeren / Toevoegen aan startscherm**.

Let op: in sommige mobiele netwerken (strikte NAT) kan een directe verbinding mislukken, omdat er geen TURN-server is ingesteld.
