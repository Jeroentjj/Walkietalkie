# Google Play: invulhulp

## Basis
- **App-naam:** Wlky
- **Pakketnaam:** app.wlky
- **Bestand:** `wlky.aab` uit de release `latest`
- **Privacyverklaring:** https://wlky.app/privacy.html
- **Categorie:** Communicatie
- **Prijs:** Gratis
- **Bevat advertenties:** Nee

## Winkelvermelding (NL)
**Korte beschrijving (max 80):**
Walkietalkie op je telefoon: druk, praat, laat los. Ook offline en versleuteld.

**Volledige beschrijving:**
Wlky maakt van je telefoon een echte walkietalkie. Houd de grote PTT-knop ingedrukt, praat, en iedereen op je kanaal hoort je, met echte radioklank en piepje.

• Privé-kanalen: maak een kanaal en deel de link. Wie erop tikt, zit erin.
• Om de beurt praten: tot 10 personen per kanaal, met wachtrij.
• Luister naar meerdere kanalen tegelijk.
• Offline: praat via Bluetooth/wifi met telefoons in de buurt, of koppel direct via QR-code. Geen internet nodig.
• Chat: stuur ook tekstberichten, online en offline.
• Versleuteld: geluid, berichten en namen worden op je telefoon versleuteld. Onze server kan niet meeluisteren.
• Geen account, geen advertenties, geen tracking.

## Store listing (EN)
**Short description:**
A real walkie-talkie on your phone: push, talk, release. Works offline, encrypted.

**Full description:**
Wlky turns your phone into a real walkie-talkie. Hold the big PTT button, talk, and everyone on your channel hears you, with real radio sound and roger beep.

• Private channels: create a channel and share the link. Anyone who taps it joins.
• Take turns: up to 10 people per channel, with a queue.
• Listen to several channels at once.
• Offline: talk over Bluetooth/wifi with nearby phones, or pair directly with a QR code. No internet needed.
• Chat: send text messages too, online and offline.
• Encrypted: voice, messages and names are encrypted on your phone. Our server cannot listen in.
• No account, no ads, no tracking.

## Gegevensveiligheid (Data safety)
- **Verzamelt de app gegevens?** Ja, alleen technisch noodzakelijk:
  - *Audio → spraak:* verzonden, versleuteld, **niet** opgeslagen; doel: app-functionaliteit; niet optioneel.
  - *Berichten → overige berichten in de app:* verzonden, versleuteld, niet opgeslagen op server; doel: app-functionaliteit.
  - *Apparaat- of andere ID's:* nee.
  - *Locatie:* nee (Bluetooth-scan wordt niet voor locatie gebruikt).
- **Versleuteld tijdens verzending:** Ja.
- **Gebruikers kunnen verwijdering aanvragen:** Ja, via privacy@wlky.app.
- **Gegevens gedeeld met derden:** Nee.

## Machtigingen uitleggen
- **RECORD_AUDIO:** spraak verzenden terwijl de gebruiker PTT ingedrukt houdt.
- **CAMERA:** QR-code scannen om twee telefoons zonder internet te koppelen.
- **BLUETOOTH_* / NEARBY_WIFI_DEVICES:** offline modus, telefoons in de buurt vinden (Nearby Connections). Niet voor locatie.
- **ACCESS_FINE_LOCATION (alleen Android 12 en ouder):** door Android vereist voor Bluetooth-scan op oude versies; niet gebruikt voor locatie.

## Contentclassificatie
Communicatie-app met door gebruikers gegenereerde inhoud tussen gebruikers onderling (spraak en chat), zonder openbaar delen. Gebruikers kunnen niet met onbekenden in contact komen: alleen via een gedeelde link of QR-code.

## Stappen
1. Maak een ontwikkelaarsaccount op https://play.google.com/console (25 dollar eenmalig).
2. App maken → naam "Wlky", standaardtaal Nederlands, App, Gratis.
3. Vul alles hierboven in (Beleid → App-content, en Groeien → Winkelvermelding).
4. Testen → Gesloten test: upload `wlky.aab`, voeg minimaal 12 testers toe (Google-e-mailadressen) en laat ze 14 dagen meedoen.
5. Daarna: Productie → Toegang aanvragen → publiceren.
6. Bij de eerste upload kies je **Play App Signing**: jouw sleutel wordt de uploadsleutel; Google beheert de definitieve sleutel.
