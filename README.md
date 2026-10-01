# Klosskoll – LEGO®-set som utgår snart

En enkel webbapp som visar LEGO-set som snart går ur sortimentet, så att du hinner köpa dem nya eller leta begagnat när de har utgått. Varje set har en länk till LEGO.com (köp nytt) och snabblänkar till Tradera, Blocket, BrickLink och eBay (köp begagnat). Appen länkar också till LEGO.com:s officiella lista ”Utgår snart”.

## Kom igång

Kräver Node.js 18 eller senare. Inga npm-paket behövs.

```bash
cp .env.example .env   # lägg in din Brickset-nyckel (se nedan)
npm start              # öppna http://localhost:3000
```

Utan nyckel visas en liten lista med exempeldata.

## Så hämtas datan (skalar till många användare)

```
Brickset API ──(1 gång/dygn, din nyckel)──▶ GitHub Actions ──▶ grenen "data" (retiring.json)
Frankfurter (ECB-kurser) ─────────────────┘                          │
                                                                     ▼
                                              jsDelivr CDN (gratis) ──▶ alla appar
                                                                     (sparar i telefonen,
                                                                      kollar högst var 6:e h)
```

- **Bara du anropar Brickset.** Workflowen `.github/workflows/data.yml` körs varje natt (04:17 UTC). Den gör ungefär 10 anrop, oavsett om appen har 10 eller 10 000 användare.
- Appen hämtar den färdiga filen från `cdn.jsdelivr.net/gh/macacan/LegoSet@data/retiring.json`. Om det inte går används `raw.githubusercontent.com`. Filen sparas i telefonen, så appen fungerar offline och frågar högst var 6:e timme.
- **Lägg in nyckeln en gång:** GitHub → repot → *Settings → Secrets and variables → Actions → New repository secret*. Namn: `BRICKSET_API_KEY`, värde: din nyckel. Kör sedan *Actions → Uppdatera data (dagligen) → Run workflow*. Utan nyckel publiceras exempeldata.
- GitHub pausar schemalagda körningar om repot inte har haft någon aktivitet på 60 dagar. Då räcker det att trycka *Enable workflow* igen.

## Navigering

Flikraden i botten har fyra flikar:

- **Utgår snart** – set som snart slutar säljas, med filter för tid och tema.
- **Köp begagnat** – set som nyss har slutat säljas.
- **Sparade** – set du har markerat med ☆.
- **Profil** – namn, valuta och favoritteman.

Varje kort har två knappar: *Köp nytt* (LEGO.com) och *Begagnat*. Begagnat öppnar ett ark med Tradera, Blocket, BrickLink och eBay. Androids tillbaka-knapp går mellan flikarna.

## Valuta och profil

- Under fliken **Profil** väljer du valuta: SEK, EUR, USD, GBP, NOK, DKK eller CAD.
  USD, GBP, EUR och CAD visar LEGO:s listpris i den regionen. SEK, NOK och DKK räknas om från det europeiska listpriset med dagens ECB-kurs och visas med ≈.
- Profilen innehåller namn, färg, valuta, favoritteman och sparade set. **Allt sparas bara i telefonen.** Det finns inget konto och ingen inloggning.

## Android-app (APK)

Varje push bygger en test-APK med GitHub Actions (`.github/workflows/android.yml`). Den publiceras som releasen **test-apk** under *Releases* i repot.

1. Öppna releasen på telefonen och ladda ner `LegoUtgarSnart.apk`.
2. Installera filen. Android frågar om du vill tillåta installation från okända källor.
3. Klart. Appen hämtar den delade datafilen, och användarna behöver ingen egen nyckel.

Test-APK:erna signeras med en fast testnyckel (`android/app/debug.keystore`), så nya versioner kan installeras ovanpå gamla. Inför Google Play behövs en egen, hemlig nyckel.

Bygga själv (kräver Android SDK och JDK 21):

```bash
npm ci && npx cap sync android
cd android && ./gradlew assembleDebug
```

## Datakälla: Brickset (gratis)

[Bricksets API v3](https://brickset.com/article/52664/api-version-3-documentation) är gratis. Det kräver ett konto och en nyckel från <https://brickset.com/tools/webservices/requestkey>. Varje set har ett `exitDate` (väntat utgångsdatum) och sista dag på LEGO.com per region.

Så här hålls antalet anrop nere:

- Servern hämtar set från de senaste `YEARS_BACK` åren (standard 4). Den tar 500 set per anrop, ett anrop i taget med paus emellan, och högst `MAX_PAGES` anrop (standard 12).
- Resultatet sparas i `cache/` och återanvänds i `CACHE_HOURS` timmar (standard 24). I praktiken blir det ungefär 10 anrop per dygn. Gränsen är 100.
- Om ett anrop misslyckas väntar servern en timme innan den försöker igen. Under tiden visas den senaste datan den har.

Appen visar set som utgår inom cirka 13 månader och set som utgick de senaste 4 månaderna (de är bra att jaga begagnat).

Vi skrapar inte LEGO.com. Deras villkor förbjuder det och sidan blockerar botar. Ett öppet API är både snällare och stabilare.

## Struktur

```
server.js           liten HTTP-server + /api/retiring
lib/brickset.js     hämtning, filtrering, disk-cache
public/data/       exempeldata när nyckel saknas
public/             frontend (HTML/CSS/JS, inget byggsteg)
public/js/          Brickset-logik, datakälla, profil, valuta
scripts/build-feed.mjs  bygger den delade datafilen (körs i GitHub Actions)
android/            Capacitor-projekt för Android-appen
test/               npm test
```

## Allt är gratis

| Del | Kostnad |
| --- | --- |
| Brickset API | Gratis nyckel, 100 `getSets`-anrop per dygn (bara den dagliga körningen anropar, ungefär 10) |
| Frankfurter (växelkurser från ECB) | Gratis, ingen nyckel |
| jsDelivr CDN + raw.githubusercontent.com | Gratis för publika GitHub-repon |
| Capacitor (Android-skal) | Öppen källkod (MIT) |
| Node.js, Gradle, Android SDK | Gratis |
| GitHub Actions + Releases | Gratis för publika repon |
| Typsnitt Fredoka och Inter (Google Fonts) | Gratis (SIL Open Font License) |
| Länkar till LEGO.com, Tradera, Blocket, BrickLink och eBay | Vanliga sök-/produktlänkar, inget API eller kostnad |

## Varumärke och upphovsrätt

- Appen heter **Klosskoll**. LEGO används bara för att beskriva vad den handlar om, så som LEGO:s *Fair Play*-riktlinjer tillåter, aldrig som appens namn eller logga.
- Designen är egen: knoppar, klossar och kraftiga färger. Ingen LEGO-logga, inget LEGO-typsnitt och inga minifigurer.
- Ikonen och splashen är en egen generisk byggkloss (vektor).
- Produktbilderna länkas från Brickset och tillhör respektive rättighetsinnehavare.
- Appen visar texten: *LEGO® är ett varumärke som tillhör LEGO-koncernen, som inte sponsrar, godkänner eller stödjer den här appen.*
