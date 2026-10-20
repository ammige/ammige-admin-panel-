# AMMIGE — Hostinger VPS Deploy Guide

> **Important:** Hostinger **Shared Hosting** (Single/Premium/Business web hosting)
> does NOT run Node.js apps — it only supports PHP. This Next.js app needs
> **Hostinger VPS** (KVM 1 or higher). Shared plan pe ye deploy nahi hoga.

## 1. VPS tayyar karo

1. Hostinger → VPS → Ubuntu 22.04 select karo.
2. SSH se connect karo aur Node.js 20 install karo:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   node -v   # v20.x.x hona chahiye
   ```
3. PM2 aur Nginx install karo:
   ```bash
   sudo npm i -g pm2
   sudo apt-get install -y nginx
   ```

## 2. Code lao (GitHub se)

```bash
cd /var/www
sudo git clone https://github.com/Taha-Siraj/ammige.git
cd ammige
npm ci
```

### 2b. Asli images lagao (zaroori — warna site pe photos toot jayengi)

GitHub repo me images **corrupt** hain (binary upload ka technical masla —
`.jpg` files me asal photo nahi, text bhara hua hai; 360° wali 8 frames me se
7 repo me hain hi nahi). Is liye clone ke baad asli images alag se copy karo:

1. Apne computer se `ammige-images-vps.tar.gz` (41 asli photos, ~1.4MB) VPS pe
   bhejo — SCP se:
   ```bash
   scp ammige-images-vps.tar.gz root@VPS_IP:/var/www/
   ```
2. VPS pe extract kar ke repo wali nakli images ke upar rakh do:
   ```bash
   cd /var/www
   tar -xzf ammige-images-vps.tar.gz -C ammige
   ```
   Ye `ammige/public/images/` ki saari files ko asli photos se replace kar dega
   (hero, collections, 260 products ki photos, aur 360° spin ki 8 frames).

> Ye step skip kiya to site khul to jayegi lekin **saari product photos broken**
> nazar ayengi aur 360° viewer kaam nahi karega.

## 3. Environment variables

`.env.production` banao (ye file git me commit NA karo):

```bash
nano .env.production
```

```ini
NODE_ENV=production
# Admin panel password — mazboot password rakho (pehli boot pe DB me save hoga)
AMMIGE_ADMIN_PASSWORD=apna-mazboot-password-yahan
# Admin session sign karne ke liye lambi random string
ADMIN_SECRET=koi-lambi-random-string-min-32-chars
# Site ka final URL (domain lagne ke baad update karo)
NEXT_PUBLIC_SITE_URL=https://ammige.com
# Customer session sign karne ke liye lambi random string
CUSTOMER_SECRET=koi-lambi-random-string-min-32-chars-2
# Database file — deploy folder se BAHAR rakho taake redeploy pe na mite
DB_PATH=/var/www/ammige-data/ammige.db
# Uploads folder (images/videos/GLB/frames) — deploy folder se BAHAR, auto-create hota hai
UPLOAD_DIR=/var/www/ammige-uploads
```

> **Zaroori:** `DB_PATH` aur `UPLOAD_DIR` deploy folder se bahar hona chahiye.
> Poori detail: [`MEDIA_STORAGE.md`](./MEDIA_STORAGE.md) — env vars, backup tareeqa,
> upload limits, aur purani data-URL images ki migration.

> Note: VPS pe database `$DB_PATH` wali file me save hoti hai jo **permanent**
> rehti hai (Vercel jaisi temporary nahi). Phir bhi regular backup lo —
> `MEDIA_STORAGE.md` §4 me backup commands hain (DB + uploads dono).

## 4. Build + start (PM2)

```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # diye gaye command ko sudo ke sath chalao taake reboot pe auto-start ho
```

Check: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/` → `200`

## 5. Domain + Nginx + SSL

1. Hostinger DNS me domain ka **A record** VPS ke IP pe point karo.
2. Nginx reverse proxy:
   ```bash
   sudo nano /etc/nginx/sites-available/ammige
   ```
   ```nginx
   server {
     listen 80;
     server_name ammige.com www.ammige.com;

     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
     }
   }
   ```
   ```bash
   sudo ln -s /etc/nginx/sites-available/ammige /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
3. Free SSL (Let's Encrypt):
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d ammige.com -d www.ammige.com
   ```

## 6. Update deploy karna

```bash
cd /var/www/ammige
git pull
npm ci
npm run build
pm2 restart ammige
```

## 7. Admin panel

`https://ammige.com/admin` — login me wahi password jo `.env.production` me
`AMMIGE_ADMIN_PASSWORD` rakha tha. Login ke baad **Settings** se password,
WhatsApp number, brand text waghera change kar sakte ho.

## Ports / firewall

Sirf 80 (HTTP), 443 (HTTPS) aur SSH (22) khule rakho. Port 3000 ko bahar se
band rakho — Nginx ke through hi traffic aana chahiye.
