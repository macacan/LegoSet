# LEGO Utgår snart

En enkel webbapp som visar LEGO-set som snart går ur sortimentet, så att du hinner köpa dem nya eller leta begagnat när de har utgått. Varje set har snabblänkar till Tradera, Blocket, BrickLink och eBay.

## Kom igång

Kräver Node.js 18 eller senare. Inga npm-paket behövs.

```bash
cp .env.example .env   # lägg in din Brickset-nyckel (se nedan)
npm start              # öppna http://localhost:3000
```

Utan nyckel visas en liten lista med exempeldata.

## Android-app (APK)

Varje push bygger en test-APK med GitHub Actions (`.github/workflows/android.yml`). Den publiceras som releasen **test-apk** under *Releases* i repot.

1. Öppna releasen på telefonen och ladda ner `LegoUtgarSnart.apk`.
2. Installera filen. Android frågar om du vill tillåta installation från okända källor.
3. Tryck på ⚙ i appen och klistra in din Brickset-nyckel.

I appen frågar telefonen Brickset direkt och sparar svaret i 24 timmar. Det behövs alltså ingen server.

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
public/js/          delad Brickset-logik + datakälla (server/app)
android/            Capacitor-projekt för Android-appen
test/               npm test
```
