# Google Play: invulhulp

## Basis
- **App-naam:** WLKY
- **Pakketnaam:** app.wlky
- **Bestand:** `wlky.aab` uit de release `latest`
- **Privacyverklaring:** https://wlky.app/privacy.html
- **Categorie:** Communicatie
- **Prijs:** Gratis, met in-app-aankopen (Plus €1,99 en Pro €4,99, eenmalig)
- **Bevat advertenties:** Nee

## Winkelvermelding (NL)
**Korte beschrijving (max 80):**
Walkietalkie op je telefoon: druk, praat, laat los. Ook offline en versleuteld.

**Volledige beschrijving:**
WLKY maakt van je telefoon een echte walkietalkie. Houd de grote PTT-knop ingedrukt, praat, en iedereen op je kanaal hoort je, met echte radioklank en piepje.

• Privé-kanalen: maak een kanaal en deel de link. Wie erop tikt, zit erin.
• Om de beurt praten: tot 10 personen per kanaal, met wachtrij.
• Luister naar meerdere kanalen tegelijk.
• Automatisch offline: staan er telefoons in de buurt op hetzelfde kanaal, dan praat WLKY direct via Bluetooth/wifi, zonder internet. Anders gebruikt het internet. Of koppel direct via QR-code.
• Chat: stuur ook tekstberichten, online en offline.
• Versleuteld: geluid, berichten en namen worden op je telefoon versleuteld. Onze server kan niet meeluisteren.
• Geen account, geen advertenties, geen tracking.

## Store listing (EN)
**Short description:**
A real walkie-talkie on your phone: push, talk, release. Works offline, encrypted.

**Full description:**
WLKY turns your phone into a real walkie-talkie. Hold the big PTT button, talk, and everyone on your channel hears you, with real radio sound and roger beep.

• Private channels: create a channel and share the link. Anyone who taps it joins.
• Take turns: up to 10 people per channel, with a queue.
• Listen to several channels at once.
• Automatically offline: if phones on the same channel are nearby, WLKY talks directly over Bluetooth/wifi, no internet needed. Otherwise it uses the internet. Or pair directly with a QR code.
• Chat: send text messages too, online and offline.
• Encrypted: voice, messages and names are encrypted on your phone. Our server cannot listen in.
• No account, no ads, no tracking.

## Gegevensveiligheid (Data safety)
- **Verzamelt de app gegevens?** Ja, alleen technisch noodzakelijk:
  - *Audio → spraak:* verzonden, versleuteld, **niet** opgeslagen; doel: app-functionaliteit; niet optioneel.
  - *Berichten → overige berichten in de app:* verzonden, versleuteld, niet opgeslagen op server; doel: app-functionaliteit.
  - *Apparaat- of andere ID's:* ja, een willekeurige apparaatcode, alleen om de dagelijkse grenzen van de gratis versie te tellen; niet gedeeld.
  - *Locatie:* nee (Bluetooth-scan wordt niet voor locatie gebruikt).
  - *Financiële info → aankoopgeschiedenis:* ja, alleen om Plus/Pro te controleren (onherleidbare code van de aankoop); niet gedeeld.
- **Versleuteld tijdens verzending:** Ja.
- **Gebruikers kunnen verwijdering aanvragen:** Ja, via privacy@wlky.app.
- **Gegevens gedeeld met derden:** Nee.

## Machtigingen uitleggen
- **RECORD_AUDIO:** spraak verzenden terwijl de gebruiker PTT ingedrukt houdt.
- **CAMERA:** QR-code scannen om twee telefoons zonder internet te koppelen.
- **BLUETOOTH_* / NEARBY_WIFI_DEVICES:** telefoons in de buurt vinden zodat ze direct, zonder internet, kunnen praten (Nearby Connections; standaard in de modus Auto, uit te zetten in het menu). Niet voor locatie.
- **ACCESS_FINE_LOCATION (alleen Android 12 en ouder):** door Android vereist voor Bluetooth-scan op oude versies; niet gebruikt voor locatie.

## Contentclassificatie
Communicatie-app met door gebruikers gegenereerde inhoud tussen gebruikers onderling (spraak en chat), zonder openbaar delen. Gebruikers kunnen niet met onbekenden in contact komen: alleen via een gedeelde link of QR-code.

## Stappen
1. Maak een ontwikkelaarsaccount op https://play.google.com/console (25 dollar eenmalig).
2. App maken → naam "WLKY", standaardtaal Nederlands, App, Gratis.
3. Vul alles hierboven in (Beleid → App-content, en Groeien → Winkelvermelding).
4. Testen → Gesloten test: upload `wlky.aab`, voeg minimaal 12 testers toe (Google-e-mailadressen) en laat ze 14 dagen meedoen.
5. Daarna: Productie → Toegang aanvragen → publiceren.
6. Bij de eerste upload kies je **Play App Signing**: jouw sleutel wordt de uploadsleutel; Google beheert de definitieve sleutel.

## Plus en Pro instellen (eenmalig)
1. **Producten:** Play Console → je app → *Inkomsten genereren* → *Producten* → *In-app-producten*. Maak er twee en activeer ze:
   - `wlky_plus`, naam "WLKY Plus", €1,99
   - `wlky_pro`, naam "WLKY Pro", €4,99
   (Dit kan pas nadat er een AAB in een testtrack staat.)
2. **Serviceaccount:** in Google Cloud (console.cloud.google.com) een project kiezen → *Google Play Android Developer API* inschakelen →
   *IAM → Serviceaccounts* → nieuw account → *Sleutels* → *Sleutel toevoegen* → JSON. Bewaar dit bestand.
3. **Rechten:** Play Console → *Gebruikers en rechten* → *Nieuwe gebruiker uitnodigen* → het e-mailadres van het serviceaccount →
   app-rechten *Financiële gegevens bekijken* en *Bestellingen beheren*.
4. **Cloudflare:** Workers & Pages → `wlky` → *Settings* → *Variables and Secrets* → *Add* → type **Secret**, naam `GOOGLE_SA`,
   waarde = de volledige inhoud van het JSON-bestand → opslaan (er volgt een nieuwe deploy).
5. **Play Integrity (nodig voor de gratis app):** Play Console → je app → *Release* → *App-integriteit* → *Play Integrity API* →
   *Cloud-project koppelen* (hetzelfde project als het serviceaccount) en in Google Cloud de *Play Integrity API* inschakelen.
   Zonder dit krijgt ook de app online de grenzen van de webversie. Een APK van GitHub (niet uit Play) krijgt altijd de webgrenzen.
6. **Testen zonder te betalen:** Play Console → *Instellingen* → *Licentietests* → voeg je eigen Gmail-adres toe.
