# Wizsla 2 – fejlesztési terv

A Wizsla kizárólag a Wiz okos izzók vezérléséért felel: helyi REST API a
belső hálózaton, Raspberry Pi-n futtatva. Más eszközök, automatizmusok és az
AI agent külön rendszerek lesznek, amelyek ezt az API-t hívják.

## Döntések

| Téma              | Döntés                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Keretrendszer     | NestJS 12 (ESM), TypeScript 6, Node.js 24 LTS                                                                 |
| Eszközök          | Vitest (unit + e2e), oxlint (típusalapú), Prettier, GitHub Actions                                            |
| Adatbázis         | SQLite + Prisma; adminisztráció az API-n át, betekintés Prisma Studióval (SSH-alagúton)                       |
| Hitelesítés       | API-kulcsok jogosultsági szintekkel: `read`, `control`, `admin`                                               |
| Futtatás a Pi-n   | PM2 natívan (konténer nélkül), fork módban, egyetlen példányban                                               |
| Monitorozás       | A meglévő Uptime Kuma figyeli a `/health` végpontot; külső telemetria nincs                                   |
| Branchek          | `develop`: fejlesztés; `main`: production (a Pi-re kerülő kód)                                                |
| Régi kód          | `v1-express` tag                                                                                              |
| Fényerő           | 10–100                                                                                                        |
| Bemeneti formátum | Egyetlen, egyértelmű formátum: számok és `#RRGGBB`. A régi `"50%"` / `"FF"` / `"3000K"` változatok megszűnnek |

Az env csak infrastruktúra-beállításokat tartalmaz (port, host, naplózási
szint, adatbázis elérési útja). Szobák, izzók és kulcsok kizárólag az
adatbázisban vannak.

## Fázisok

### 0. Előkészítés ✅

- `v1-express` tag, `develop` branch, új NestJS váz.
- Env-validáció induláskor (zod), `/health` végpont.
- Lint, típusellenőrzés, unit és e2e tesztek, build; CI minden pushra.

### 1. Wiz protokoll réteg

NestJS-től független rész.

- `UdpTransport`: időkorlát (~1 mp), 2 újrapróbálkozás; izzónként sorba
  rendezett parancsok.
- `WizClient`: `getPilot`, `setPilot`, `getSystemConfig`, felderítés broadcasttal.
- Scene-katalógus konstansként a kódban; képességek a modulnévből
  (RGB / hangolható fehér / dimmelhető).
- UDP izzószimulátor a tesztekhez.

**Kész, ha:** a szimulátoros tesztek lefedik a sikeres választ, az
időtúllépést, a hibás választ és a nem támogatott képességet, és egy valódi
izzón is működik a kézi próba.

**Valódi izzón ellenőrizendő:** modellenkénti Kelvin-tartomány.

### 2. Adatbázis és hitelesítés

- Prisma + SQLite, migrációk.
- `Room`: név, slug, sorrend.
- `Bulb`: név, MAC (egyedi, ez az azonosító), IP, port, szoba (opcionális),
  modell, képességek, `enabled`, `lastSeenAt`.
- `ApiKey`: név, hash, előtag, jogosultságok, utolsó használat, visszavonás.
- Globális guard, végpontonkénti jogosultság; CLI parancs az első admin
  kulcshoz; Swagger „Authorize”. Kivétel a `/health`, ami az Uptime Kuma
  miatt kulcs nélkül is elérhető.

**Kész, ha:** kulcs nélkül minden 401, `read` kulccsal nem lehet kapcsolni,
a visszavont kulcs azonnal megszűnik.

### 3. Szobák és izzók adminisztrációja

- CRUD szobákra és izzókra.
- `POST /discovery/scan`: felderítés; az új izzók szoba nélkül kerülnek be.
  Ha egy ismert MAC új IP-n jelentkezik, az IP automatikusan frissül.
- `POST /bulbs/:id/identify`: az izzó néhányszor felvillan, majd visszaáll.
- Swagger UI a `/docs` címen.

**Kész, ha:** a 4 szoba (nappali 2, étkező 6, konyha 2, háló 2 izzó) az API-n
keresztül felvehető, és az izzók felderítéssel és villogtatással szobához
rendelhetők.

### 4. Állapot

- Izzónként memóriában tartott állapot: be/ki, fényerő, szín / Kelvin / scene,
  `online`, `lastUpdated`.
- Háttérlekérdezés 15–30 mp-enként, és minden parancs után azonnal.
- `GET /state`, `GET /rooms/:id/state` (összesítéssel), `GET /bulbs/:id/state`;
  `?refresh=true` friss lekérdezéshez.

**Kész, ha:** a Wiz appban vagy a fali kapcsolóval végzett változás egy
lekérdezési cikluson belül megjelenik, a lekapcsolt izzó `online: false`.

### 5. Vezérlés

- `PATCH /bulbs/:id/state`, `PATCH /rooms/:id/state`, `PATCH /state`, közös DTO-val:

  ```jsonc
  {
    "on": true,
    "brightness": 30, // vagy "brightnessDelta": -10
    "colorTemp": 2700, // vagy "colorTempDelta": -300
    "color": "#FF8800", // vagy "scene": "sunset"
    "speed": 100, // dinamikus scene-ekhez
  }
  ```

- A `color`, `colorTemp` és `scene` közül egyszerre csak egy; a delta és az
  abszolút érték kizárja egymást.
- Szobaszinten párhuzamos végrehajtás, izzónkénti eredménnyel (siker /
  offline / nem támogatott) és az új állapottal.
- Parancsnapló: melyik kulcs, mikor, mit.

**Kész, ha:** a régi wizsla minden funkciója működik izzóra, szobára és az
egész lakásra.

### 6. Üzemeltetés a Pi-n

- Strukturált naplózás (pino); `/health` adatbázissal és az elérhető izzók
  számával.
- PM2: `ecosystem.config.cjs` a repóban (a csomag ESM, ezért `.cjs`),
  `exec_mode: 'fork'`, `instances: 1`; `pm2-logrotate`; `pm2 startup` és
  `pm2 save`, hogy újraindítás után is elinduljon.
- Uptime Kuma monitor a `/health` végpontra („HTTP(s) – Json Query”, a
  `status` mezőre). A `/health` API-kulcs nélkül is elérhető marad, és
  503-mal válaszol, ha az adatbázis nem érhető el.
- Napi adatbázismentés (`sqlite3 .backup`).
- Kiadás: `develop` → `main` merge, verziótag, a Pi a `main`-t futtatja.

**Kész, ha:** a Pi újraindítása után magától elindul, és a régi Express-es
szolgáltatás leállítható.

### Később

- SSE (`GET /events`): élő állapotváltozások a mobil appnak.
- Push alapú állapotfrissítés (`registration` / `syncPilot`), előbb valódi
  izzókon kipróbálva.
- Saját presetek (pl. „Mozi”) az adatbázisban.
- HTTPS Caddyvel.
- Szoba-becenevek az AI agenthez.
- Deploy folyamat a `main` branchről a PM2-be (külön tervezzük meg).
