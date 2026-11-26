# Üzemeltetés a Pi-n

A Wizsla a `jerry` nevű Raspberry Pi-n fut PM2 alatt, a `taki` felhasználóval,
a `main` ágról, a `/opt/wizsla` könyvtárból. Ez a leírás az első telepítést,
a frissítést és a napi üzemeltetést írja le.

A helyi hálózaton „élesnek” számító alkalmazások a `/opt/<alkalmazás>` alatt
vannak (az FHS szerint ez a helye az önállóan telepített alkalmazásoknak). A
`/opt` a root tulajdonában marad, csak az alkalmazások mappái a `taki`-éi.

## Előfeltételek

- Node 24 (a `.nvmrc` szerint; a telepítő szkript ellenőrzi), nvm-mel:
  `nvm install 24 && nvm alias default 24`.
- `git`, `curl`, PM2 és `pm2-logrotate` (ezek már megvannak).
- `build-essential` (megvan): a `better-sqlite3` ha nem talál előre fordított
  binárist, ezzel fordítja le magát.

### Node-verzió és PM2

A PM2 háttérfolyamatát a `pm2-taki.service` indítja a rendszer Node-jával
(22), és ugyanez futtatja az Uptime Kumát is. A Wizsla ettől függetlenül
azon a Node-on fut, amelyikkel a `deploy.sh` futott (nvm, 24): az
`ecosystem.config.cjs` ennek az útvonalát adja meg értelmezőként. A
`/health` válasz `node` mezője mutatja, min fut ténylegesen; ha eltér, a
szkript figyelmeztet. nvm-es Node-frissítés után a szkript magától átállítja
a Wizslát az új Node-ra.

## Első telepítés

```bash
sudo install -d -o taki -g taki /opt/wizsla
git clone https://github.com/airtaki/wizsla.git /opt/wizsla
cd /opt/wizsla
git checkout main
cp .env.example .env
nano .env        # NODE_ENV=production, PORT=3200, a többi maradhat
./scripts/deploy.sh
```

A `jerry` vezetékesen és Wi-Fin is a hálózaton van, az izzók viszont csak a
Wi-Fi hálózatban (`192.168.10.0/23`). Az alapértelmezett
`255.255.255.255` broadcast a vezetékes kapcsolaton menne ki, ezért a
`.env`-ben a Wi-Fi hálózat broadcast címe szerepel:

```bash
WIZ_BROADCAST_ADDRESS=192.168.11.255
```

A szkript telepíti a függőségeket, létrehozza az adatbázist
(`/opt/wizsla/data/wizsla.db`), lefordítja a kódot, elindítja PM2 alatt `wizsla` néven,
és megvárja, amíg a `/health` válaszol.

Ezután az első admin kulcs és az izzók:

```bash
cd /opt/wizsla && npm run cli -- apikey:create --name "Admin" --level admin
```

A kulcsot tedd el (jelszókezelőbe), majd a Swagger UI-ban
(`http://jerry:3200/docs`, vagy `http://192.168.8.89:3200/docs`):

1. `POST /discovery/scan` – felveszi az összes izzót.
2. `POST /rooms` – a négy szoba.
3. `POST /bulbs/{ref}/identify`, majd `PATCH /bulbs/{ref}` – név és szoba.

A Pi újraindítása után is elindul: a `pm2-taki.service` már engedélyezve
van (`pm2 startup` nem kell), a szkript pedig `pm2 save`-et futtat.

## Frissítés

A `develop` ágon fejlesztünk; kiadáskor a `develop` a `main`-be kerül. Utána
a Pi-n:

```bash
/opt/wizsla/scripts/deploy.sh
```

Lépései: a `main` lehúzása (csak fast-forward), adatbázismentés a migrációk
előtt, `npm ci`, `npm run db:deploy`, `npm run build`,
`pm2 startOrReload`, `pm2 save`, végül a `/health` megvárása. Ha a Pi-n
helyi módosítás van a repóban, a szkript leáll, és nem ír felül semmit.

## Felügyelet (Uptime Kuma)

Új monitor:

- Típus: **HTTP(s) – Json Query**
- URL: `http://127.0.0.1:3200/health` (ugyanazon a Pi-n fut)
- Json Query: `status`, elvárt érték: `ok`
- Intervallum: 60 mp

A `/health` API-kulcs nélkül elérhető, csak az adatbázist és a memóriát
nézi, izzót nem kérdez. Adatbázishiba esetén 503-mal és `"status": "error"`
-ral válaszol. Az offline izzók nem teszik hibássá (a lekapcsolt fali kapcsoló
normális állapot); a `bulbs.online` mezőre külön monitor is tehető.

```json
{
  "status": "ok",
  "version": "2.0.0",
  "node": "v24.22.3",
  "uptime": 3600,
  "database": "ok",
  "bulbs": { "total": 12, "online": 12 },
  "lastBackup": "2026-11-27T03:00:00.000Z"
}
```

## Naplók

```bash
pm2 logs wizsla             # élő napló
pm2 logs wizsla --lines 200
```

A `pm2-logrotate` forgatja a naplófájlokat. Minden vezérlő parancs egy sort
ír („Telefon → Konyha: {"on":true} (2/2 ok)”), és a `GET /commands`
végponton (admin) 90 napig visszakereshető. `LOG_FORMAT=json` esetén minden
sor egy JSON objektum (pl. `jq`-val szűrhető).

## Adatbázismentés

A szolgáltatás naponta ment a `/opt/wizsla/data/backups/` könyvtárba (`VACUUM INTO`, futás
közben is konzisztens), és a legutóbbi 14-et tartja meg (`BACKUP_KEEP`).
Kézzel: `npm run cli -- db:backup`.

Visszaállítás:

```bash
cd /opt/wizsla
pm2 stop wizsla
cp data/backups/wizsla-20261127-030000.db data/wizsla.db
pm2 start wizsla
```

A mentések ugyanazon az SD kártyán vannak; ha a kártya tönkremegy, velük
együtt vesznek el. Érdemes a `data/backups/` könyvtárat időnként egy másik
gépre is átmásolni.

## Prisma Studio a Pi-n

```bash
# a Pi-n:
cd /opt/wizsla && npm run db:studio
# a saját gépeden:
ssh -L 5555:localhost:5555 taki@jerry
```

Majd a böngészőben `http://localhost:5555`.

## Hibaelhárítás

| Tünet                                 | Teendő                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `pm2 list` szerint újra és újra indul | `pm2 logs wizsla`: többnyire hibás `.env` (a hibás változót megnevezi) |
| Egy izzó tartósan `online: false`     | áram van rajta? Ha igen: `POST /discovery/scan` (új IP-t kaphatott)    |
| Felderítés nem talál izzót            | `WIZ_BROADCAST_ADDRESS` a Wi-Fi hálózaté? (`192.168.11.255`)           |
| `/health` 503                         | `pm2 logs wizsla`; lemez megtelt? (`df -h`)                            |
