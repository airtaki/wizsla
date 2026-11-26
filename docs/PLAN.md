# Wizsla 2 – fejlesztési terv

A Wizsla kizárólag a Wiz okos izzók vezérléséért felel: helyi REST API a
belső hálózaton, Raspberry Pi-n futtatva. Más eszközök, automatizmusok és az
AI agent külön rendszerek lesznek, amelyek ezt az API-t hívják.

## Döntések

| Téma              | Döntés                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Keretrendszer     | NestJS 12 (ESM), TypeScript 6, Node.js 24 LTS                                                                      |
| Eszközök          | Vitest (unit + e2e), oxlint (típusalapú), Prettier, GitHub Actions                                                 |
| Validáció         | HTTP-kérések: class-validator + globális `ValidationPipe`; env és izzóválaszok: zod                                |
| Adatbázis         | SQLite + Prisma 7 (better-sqlite3 adapter); adminisztráció az API-n át, betekintés Prisma Studióval (SSH-alagúton) |
| Telemetria        | Nincs: a Prisma CLI frissítésellenőrzése kikapcsolva (`CHECKPOINT_DISABLE=1`), NestJS Observe nincs                |
| Hitelesítés       | API-kulcsok jogosultsági szintekkel: `read`, `control`, `admin`                                                    |
| Futtatás a Pi-n   | PM2 natívan (konténer nélkül), fork módban, egyetlen példányban                                                    |
| Monitorozás       | A meglévő Uptime Kuma figyeli a `/health` végpontot; külső telemetria nincs                                        |
| Branchek          | `develop`: fejlesztés; `main`: production (a Pi-re kerülő kód)                                                     |
| Régi kód          | `v1-express` tag                                                                                                   |
| Fényerő           | 10–100                                                                                                             |
| Bemeneti formátum | Egyetlen, egyértelmű formátum: számok és `#RRGGBB`. A régi `"50%"` / `"FF"` / `"3000K"` változatok megszűnnek      |

Az env csak infrastruktúra-beállításokat tartalmaz (port, host, naplózási
szint, adatbázis elérési útja, a Wiz hálózati időzítések és lekérdezési
időköz). Szobák, izzók és kulcsok kizárólag az
adatbázisban vannak.

## Fázisok

### 0. Előkészítés ✅

- `v1-express` tag, `develop` branch, új NestJS váz.
- Env-validáció induláskor (zod), `/health` végpont.
- Lint, típusellenőrzés, unit és e2e tesztek, build; CI minden pushra.

### 1. Wiz protokoll réteg ✅

NestJS-től független rész (`src/wiz/`).

- `UdpTransport`: időkorlát (1 mp), 2 újrapróbálkozás, a korábbi próbálkozásra
  késve érkező választ is elfogadja; izzónként sorba rendezett parancsok.
- `WizClient`: `getPilot`, `setPilot`, `getSystemConfig`, `getModelConfig`,
  felderítés broadcasttal (csak olvas, nem regisztrál semmit). A paramétereket
  küldés előtt, a válaszokat érkezéskor ellenőrzi.
- Scene-katalógus konstansként a kódban; képességek a modulnévből, a Kelvin-
  tartomány a `getModelConfig` válaszából.
- UDP izzószimulátor a tesztekhez (`test/support/fake-wiz-bulb.ts`).
- Kézi próbához: `npm run wiz -- discover | status <ip> | config <ip> | set <ip> <json>`
  (előtte `npm run build`).

**Valódi izzókon mért eredmények (2026-11-26):**

- 12 izzó, mind RGB (`ESP25_SHRGB_01`, `ESP24_SHRGB_01`, `ESP24_SHRGBC_01`),
  firmware 1.38.0.
- Kelvin-tartomány mindegyiken 2200–6500.
- `minDimLevel` 7 izzón 1, ötön 10; a döntés szerint a fényerő 10–100 marad.
- 12 izzó állapotának párhuzamos lekérdezése ~50 ms.
- `setPilot` valódi izzón kipróbálva (`192.168.10.156`: be, 30%, 2700 K);
  a visszaolvasott állapot egyezett.

### 2. Adatbázis és hitelesítés ✅

- Prisma 7 + SQLite (`prisma/schema.prisma`, `prisma.config.ts`), migrációk
  a `prisma/migrations` alatt. A generált kliens a `src/generated/` alatt
  van, a git nem követi; az `npm install` generálja (`postinstall`).
- `Room`: név, slug, sorrend.
- `Bulb`: név, MAC (egyedi, ez az azonosító), slug, IP, port, szoba
  (opcionális), modulnév, firmware, típus, Kelvin-tartomány, `enabled`,
  `lastSeenAt`.
- `ApiKey`: név, előtag, SHA-256 hash, szint, létrehozás, utolsó használat
  (legfeljebb percenként frissül), visszavonás. A kulcs formája
  `wzs_` + 32 véletlen karakter; maga a kulcs sehol nincs tárolva.
- Globális guard: `X-API-Key: <kulcs>` vagy `Authorization: Bearer <kulcs>`.
  A szintek egymásra épülnek (`admin` ⊃ `control` ⊃ `read`). Szint
  megjelölése nélkül egy végpont `admin` szintet kér, így egy elfelejtett
  jelölés a biztonságos irányba hibázik. A `/health` és a `/docs` nyilvános.
- `GET/POST /api-keys`, `DELETE /api-keys/:id` (visszavonás); az utolsó
  aktív admin kulcs nem vonható vissza (409).
- CLI: `npm run cli -- apikey:create --name <név> --level <szint>`,
  `apikey:list`, `apikey:revoke <id>`.
- Swagger UI a `/docs`, OpenAPI a `/docs-json` címen, „Authorize” gombbal;
  internet nélkül is működik.
- E2E tesztek futásonként saját, ideiglenes SQLite adatbázissal.

**Kész, ha:** kulcs nélkül minden 401, `read` kulccsal nem lehet kapcsolni,
a visszavont kulcs azonnal megszűnik. ✅

### 3. Szobák és izzók adminisztrációja ✅

- CRUD szobákra és izzókra. Hivatkozás id-vel vagy sluggal (`/rooms/etkezo`);
  a slug a névből képződik ékezetek nélkül, és átnevezéskor nem változik.
- `POST /discovery/scan`: felderítés; az új izzók szoba nélkül kerülnek be
  („Wiz xxxxxx” névvel). Ha egy ismert MAC új IP-n jelentkezik, az IP
  automatikusan frissül; a nem válaszoló regisztrált izzók `missing` listában
  jönnek vissza. Törlés sosem történik.
- `POST /bulbs/:ref/identify`: az izzó háromszor felvillan, majd visszaáll.
- `GET /bulbs?room=<ref|none>`: szűrés szobára, illetve a szoba nélküliekre.
- A nevek magyar ábécérend szerint rendeződnek („Nappali 2” a „Nappali 10”
  előtt), mert az SQLite bájtsorrendben rendezne.
- Hibák: elérhetetlen izzó 504, hibás izzóválasz 502, ütköző név/slug/MAC 409.
- Új env: `WIZ_BROADCAST_ADDRESS`, `WIZ_PORT`, `WIZ_TIMEOUT_MS`,
  `WIZ_RETRIES`, `WIZ_DISCOVERY_MS`.

Valós hálózaton ellenőrizve: a felderítés ~5 mp alatt mind a 12 izzót
regisztrálta, helyes modellel, firmware-rel és színhőmérséklet-tartománnyal.

**Kész, ha:** a 4 szoba (nappali 2, étkező 6, konyha 2, háló 2 izzó) az API-n
keresztül felvehető, és az izzók felderítéssel és villogtatással szobához
rendelhetők. ✅ (A szobák felvétele és az izzók beosztása kézi lépés, a Swagger UI-ból.)

### 4. Állapot ✅

- Izzónként memóriában tartott utolsó leolvasás: be/ki, fényerő, Kelvin /
  RGB / scene (névvel), RSSI, `online`, `stateAt` (mikor olvastuk),
  `checkedAt` (mikor kérdeztük utoljára), és hiba esetén `error`.
- Háttérlekérdezés induláskor, majd `WIZ_POLL_INTERVAL_MS` (alapból 20 mp)
  időközönként; a következő kör csak az előző végeztével indul. `0` kikapcsolja.
  A letiltott (`enabled: false`) izzókat nem kérdezzük.
- `GET /state` (szobák és szoba nélküli izzók), `GET /rooms/:ref/state`,
  `GET /bulbs/:ref/state`; `?refresh=true` friss lekérdezéshez. Egy izzót
  egyszerre csak egy kérés kérdez, az átfedő kérések osztoznak a válaszon.
- Összesítés szobánként és összesen: hány izzó van, hány online, hány ég,
  az égők átlagos fényereje és (fehér módban) színhőmérséklete.
- Offline izzónál az utolsó ismert állapot megmarad (`online: false`,
  régebbi `stateAt`). Ha egy izzó IP-jén másik MAC válaszol (DHCP-csere),
  az izzó offline lesz, a hibaüzenet felderítést javasol.
- `lastSeenAt` az adatbázisban legfeljebb 5 percenként frissül.
- A „minden parancs után azonnal” frissítés az 5. fázissal jön.

Valós hálózaton ellenőrizve: 12 izzó friss lekérdezése ~0,26 mp, a
memóriából adott válasz ~0,02 mp.

**Kész, ha:** a Wiz appban vagy a fali kapcsolóval végzett változás egy
lekérdezési cikluson belül megjelenik, a lekapcsolt izzó `online: false`. ✅
(Szimulált izzókkal tesztelve; a fali kapcsolós próbát érdemes egyszer
élőben is megnézni.)

### 5. Vezérlés ✅

- `PATCH /bulbs/:ref/state`, `PATCH /rooms/:ref/state`, `PATCH /state`, közös DTO-val:

  ```jsonc
  {
    "on": true,
    "brightness": 30, // vagy "brightnessDelta": -10
    "colorTemp": 2700, // vagy "colorTempDelta": -300
    "color": "#FF8800", // vagy "scene": "sunset" (id, slug vagy név)
    "warmWhite": 40, // csak color mellé, "coldWhite" is
    "speed": 100, // dinamikus scene-ekhez
  }
  ```

- A `color`, `colorTemp` / `colorTempDelta` és `scene` közül egyszerre csak
  egy; a delta és az abszolút érték kizárja egymást; az `on: false` mellé
  semmi más nem adható. Bármi beállítása be is kapcsolja a lámpát.
- A delta izzónként a saját aktuális állapotához adódik (előbb kiolvassuk),
  és a határokon belül marad: fényerő 10–100, Kelvin az izzó tartománya. A
  `colorTempDelta` fehér módban és statikus fehér scene-ben (Warm White,
  Daylight…) működik, mert ezek is jelentik a Kelvin-értéket; színes módban
  és dinamikus scene-ben `unsupported`, a javaslat: adj meg `colorTemp`-et.
- Izzónként képességellenőrzés (`kind`, Kelvin-tartomány, scene-támogatás).
- Szobaszinten és az egész lakásra párhuzamos végrehajtás, izzónkénti
  eredménnyel (`ok` / `offline` / `unsupported` / `failed`), összesítéssel
  és a parancs utáni friss állapottal; mindig 200. Egy izzónál a hiba HTTP
  kód: 400 nem támogatott, 504 nem válaszol, 502 hibás válasz, 409 letiltott.
- A letiltott izzók kimaradnak a szoba- és lakásszintű parancsokból.
- A parancs után az állapotot azonnal visszaolvassuk és a gyorsítótárba írjuk.
- `GET /scenes` (read): a beépített scene-ek és hogy melyik izzótípus tudja.
- Parancsnapló (`CommandLog` tábla, új migráció): melyik kulcs, mikor, mire,
  mit, hány izzón sikerült, mennyi ideig tartott; 90 napig őrizzük.
  `GET /commands?limit=` (admin). A PM2 naplóba is kerül egy sor parancsonként.

**Kész, ha:** a régi wizsla minden funkciója működik izzóra, szobára és az
egész lakásra. ✅ (be, ki, fényerő, sebesség, scene, RGB + hideg/meleg fehér,
színhőmérséklet; a régi `status` helyett a 4. fázis állapotvégpontjai.)

Élesben ellenőrizve mind a 12 izzón (egy izzó, egy 3 izzós tesztszoba, az
egész lakás): minden lépés 12/12 sikeres, 0,1–0,6 mp alatt; utána minden izzó
visszaállt a teszt előtti állapotára. Az éles teszt hozta ki, hogy a
statikus fehér scene-ek jelentik a Kelvin-értéket; ezt az állapot és a delta
azóta használja.

### 6. Üzemeltetés a Pi-n

A repó oldala kész; a Pi-n végzendő lépések: [DEPLOY.md](DEPLOY.md).

- ✅ Naplózás: a Nest beépített naplózója, `LOG_FORMAT=json` esetén soronként
  egy JSON objektum. A tervezett pino helyett, mert a Nest 12 ezt már
  függőség nélkül tudja (pino, pino-http, nestjs-pino nélkül).
- ✅ `/health`: verzió, uptime, adatbázis, engedélyezett / online izzók
  (memóriából, izzót nem kérdez), utolsó mentés ideje; adatbázishiba esetén
  503 és `"status": "error"`. API-kulcs nélkül elérhető.
- ✅ PM2: `ecosystem.config.cjs` (`fork`, 1 példány, munkakönyvtár a projekt
  gyökere, exponenciális újraindítási késleltetés, 300 MB memóriakorlát).
  Az értelmező a telepítő shell Node-ja (nvm, 24), mert a PM2 démon a
  rendszer Node 22-jével indul és az Uptime Kumát is futtatja; a `/health`
  `node` mezője mutatja a ténylegeset.
- ✅ Napi adatbázismentés a szolgáltatáson belül (`VACUUM INTO`, nem kell
  hozzá `sqlite3` CLI), a legutóbbi 14 marad; induláskor és óránként nézi,
  így újraindítás miatt nem marad ki és nem duplázódik. Kézzel:
  `npm run cli -- db:backup`.
- ✅ `scripts/deploy.sh`: Node-verzió ellenőrzés, `main` fast-forward,
  mentés a migrációk előtt, `npm ci`, `db:deploy`, build,
  `pm2 startOrReload`, `pm2 save`, `/health` megvárása.
- A Pi-n: első telepítés, Uptime Kuma monitor, a `better-sqlite3` és a
  Prisma migrációs bináris ellenőrzése (Debian 11, OpenSSL 1.1). A
  `pm2-taki.service` már engedélyezve van.
- Kiadás: `develop` → `main` merge, verziótag, a Pi a `main`-t futtatja.

**Kész, ha:** a Pi újraindítása után magától elindul. (A régi Express-es
szolgáltatás élesben sosem futott, így nincs mit leállítani.)

### Később

- SSE (`GET /events`): élő állapotváltozások a mobil appnak.
- Push alapú állapotfrissítés (`registration` / `syncPilot`), előbb valódi
  izzókon kipróbálva.
- Saját presetek (pl. „Mozi”) az adatbázisban.
- HTTPS Caddyvel.
- Szoba-becenevek az AI agenthez.
- Deploy folyamat a `main` branchről a PM2-be (külön tervezzük meg).
