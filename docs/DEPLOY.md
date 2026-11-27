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

A kulcsot tedd el (jelszókezelőbe). A webapp a `http://jerry:3200/` címen
érhető el (a `/app`-ra irányít), ezzel a kulccsal lehet belépni; a HTTPS
beállítása után (lásd lent) otthonról a `https://wizsla.ilh.hu/app/`
címen. Amíg a
webappban nincs adminfelület, a Swagger UI-ban
(`http://jerry:3200/docs`, vagy `http://192.168.8.89:3200/docs`):

1. `POST /discovery/scan` – felveszi az összes izzót.
2. `POST /rooms` – a négy szoba.
3. `POST /bulbs/{ref}/identify`, majd `PATCH /bulbs/{ref}` – név és szoba.

A Pi újraindítása után is elindul: a `pm2-taki.service` már engedélyezve
van (`pm2 startup` nem kell), a szkript pedig `pm2 save`-et futtat.

## HTTPS: `https://wizsla.ilh.hu/app/`

Az iPhone-on a főképernyős webapphoz és a service workerhez HTTPS kell, és így
az API-kulcs sem utazik titkosítatlanul a Wi-Fin. A Pi-n már futó nginx adja.
A Wizsla csak otthonról érhető el, kívülről semmilyen úton.

- A `wizsla.ilh.hu` a Pi Wi-Fi-címére (`192.168.11.209`) mutat, a nyilvános
  DNS-ben és a Pi-hole-ban is. Kívülről ez a cím semmit nem ér el.
- Az nginx csak ezen a címen szolgálja ki a Wizslát. Az internetről jövő
  továbbítások a vezetékes címre (`192.168.8.89`) érkeznek, így ide nem
  jutnak el. Második védővonalként csak a `192.168.8.0/22` hálózatból fogad
  kérést.
- A tanúsítvány Let's Encrypt, DNS-ellenőrzéssel és kézi megújítással (a
  DNS-szolgáltatónak nincs API-ja). A 80-as port nem kell hozzá. Ha a név
  egyszer API-val kezelhető DNS-re kerül, a megújítás automatizálható.
- Az `airtaki.ddns.net` (az üres oldal, a certbot a 80-as porton, a
  monitorok) és a 19080-as továbbítás a Macre változatlan.

### DNS

- A szolgáltatónál: `wizsla.ilh.hu` A-rekord → `192.168.11.209`.
- A Pi-hole-ban ugyanez helyi rekordként (Local DNS → DNS Records), hogy
  internetkimaradáskor is feloldható legyen.

A Pi Wi-Fi-címének fixnek kell maradnia (a `192.168.11.x` a fix címek
tartománya).

### Tanúsítvány

```bash
sudo certbot certonly --manual --preferred-challenges dns -d wizsla.ilh.hu --deploy-hook 'systemctl reload nginx'
```

A certbot kiír egy TXT-rekordot (`_acme-challenge.wizsla.ilh.hu` és egy
hosszú érték), és megvárja az Entert; ezzel nem kell sietni. Vedd fel a
rekordot a szolgáltatónál. Ha a felület a domaint magától hozzáfűzi a
névhez, a név csak `_acme-challenge.wizsla`. Entert csak akkor nyomj, ha a
domain összes névszerverén látszik az érték. Ellenőrzés egy másik
terminálban, a Pi-n (`dnsutils` csomag) vagy a Macen:

```bash
for ns in $(dig +short NS ilh.hu); do echo "$ns: $(dig +short TXT _acme-challenge.wizsla.ilh.hu @$ns)"; done
```

Ha egy szerveren üres, várj, és futtasd újra: a szolgáltató felülete és a
másodlagos névszerverek késve frissülhetnek. Ha az Enter túl korán jön, a
Let's Encrypt `NXDOMAIN` hibát ad; ilyenkor a parancs újraindítható, és új
értéket kér ugyanarra a névre.

A kiadás után a TXT-rekord törölhető.

**Megújítás:** ugyanez a parancs; a certbot megkérdezi, megújítsa-e, és új
TXT-értéket ad. A tanúsítvány 90 napig érvényes (a Let's Encrypt ezt 2027-től
64, 2028-tól 45 napra rövidíti), és lejárat előtt nem küld e-mailt, ezért az
Uptime Kuma figyeli (lent). A certbot időzítője a lejárat közeledtével
magától is megpróbálja megújítani; kézi tanúsítványnál ez hibával végződik a
naplóban (`/var/log/letsencrypt/`), az `airtaki.ddns.net` megújítását nem
zavarja.

### nginx

```bash
cd /opt/wizsla
sudo cp deploy/nginx/wizsla.conf /etc/nginx/sites-available/wizsla
sudo ln -s /etc/nginx/sites-available/wizsla /etc/nginx/sites-enabled/wizsla
sudo nginx -t && sudo systemctl reload nginx
```

Másolat, nem link az `/opt`-ba: az nginx beállításai a root kezében
maradnak. Ha a Wizsla `PORT`-ja nem 3200, a fájlban is írd át. Az
`airtaki.ddns.net` beállításaihoz nem kell nyúlni.

### Ellenőrzés

- Telefonon, otthoni Wi-Fin: `https://wizsla.ilh.hu/app/` → a Wizsla
  bejelentkezése.
- A Pi-n: `curl -s https://wizsla.ilh.hu/health` → a Wizsla JSON-ja.
- Telefonon, mobilneten (Wi-Fi kikapcsolva): a `https://wizsla.ilh.hu` nem
  tölt be.
- A `https://airtaki.ddns.net/` továbbra is az üres oldal.

### Uptime Kuma: a tanúsítvány lejárata

Új monitor:

- Típus: **HTTP(s)**, URL: `https://wizsla.ilh.hu/health`
- **Certificate Expiry Notification** bekapcsolva

Alapból 21, 14 és 7 nappal a lejárat előtt szól (Beállítások →
Értesítések). Egyben azt is figyeli, hogy a Wizsla elérhető-e az nginx-en át.

### Utána: a Wizsla csak az nginx-en át

Ha a HTTPS működik, a Wizsla ne fogadjon közvetlen kapcsolatot a hálózatról.
A `.env`-ben:

```bash
HOST=127.0.0.1
```

majd `pm2 restart wizsla`. A `http://jerry:3200` cím ezután a hálózatról nem
érhető el; az Uptime Kuma `127.0.0.1`-es `/health` monitora és az izzók
(UDP) nem érintettek.

### Mellékesen: az `airtaki.ddns.net` megújítása

Az nginx a tanúsítványokat induláskor olvassa be, így az `airtaki.ddns.net`
megújított tanúsítványa eddig csak a következő újraindításkor lépett életbe.
Ez a hook megújítás után újratölti az nginx-et:

```bash
printf '#!/bin/sh\nsystemctl reload nginx\n' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
```

## Frissítés

A `develop` ágon fejlesztünk; kiadáskor a `develop` a `main`-be kerül. Utána
a Pi-n:

```bash
/opt/wizsla/scripts/deploy.sh
```

Lépései: a `main` lehúzása (csak fast-forward), adatbázismentés a migrációk
előtt, `npm ci`, `npm run db:deploy`, `npm run build`, a webapp fordítása
(`web/`: `npm ci`, `npm run build`), `pm2 startOrReload`, `pm2 save`, végül a
`/health` megvárása. Ha a Pi-n
helyi módosítás van a repóban, a szkript leáll, és nem ír felül semmit.

## Felügyelet (Uptime Kuma)

Új monitor:

- Típus: **HTTP(s) – Json Query**
- URL: `http://127.0.0.1:3200/health` (ugyanazon a Pi-n fut)
- Json Query: `status`, elvárt érték: `ok`
- Intervallum: 60 mp, újrapróbálkozás: 2 (a telepítéskori rövid újraindítás
  ne riasszon)

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

| Tünet                                      | Teendő                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `pm2 list` szerint újra és újra indul      | `pm2 logs wizsla`: többnyire hibás `.env` (a hibás változót megnevezi)    |
| Egy izzó tartósan `online: false`          | áram van rajta? Ha igen: `POST /discovery/scan` (új IP-t kaphatott)       |
| Felderítés nem talál izzót                 | `WIZ_BROADCAST_ADDRESS` a Wi-Fi hálózaté? (`192.168.11.255`)              |
| `/health` 503                              | `pm2 logs wizsla`; lemez megtelt? (`df -h`)                               |
| `https://wizsla.ilh.hu` otthon nem tölt be | `ping wizsla.ilh.hu`: a `192.168.11.209`-et adja? Fent van a Pi Wi-Fi-je? |
| 403 a `wizsla.ilh.hu`-n                    | a kérés nem a `192.168.8.0/22`-ből jön (pl. VPN be van kapcsolva)         |
| 502 a `wizsla.ilh.hu`-n                    | a Wizsla nem fut, vagy a `wizsla.conf` portja nem a `PORT`                |
| Tanúsítványhiba a böngészőben              | lejárt: megújítás (HTTPS → Tanúsítvány)                                   |
