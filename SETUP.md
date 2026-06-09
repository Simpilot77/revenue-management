# Revenue Management Tool – Setup-Anleitung

## Voraussetzungen

- Node.js 18+ auf dem Hostinger VPS
- MySQL-Datenbank (Hostinger bietet MySQL in der Verwaltungskonsole)

---

## 1. Datenbank einrichten (Hostinger)

1. Hostinger Verwaltungskonsole → **Datenbanken** → Neue MySQL-Datenbank anlegen
2. Name: `revenue_management`, Benutzer + Passwort notieren
3. phpMyAdmin öffnen → SQL-Reiter → Inhalt von `backend/src/db/schema.sql` einfügen und ausführen

---

## 2. Backend deployen (Hostinger VPS)

```bash
# Auf dem VPS (per SSH):
git clone <ihr-repo> /var/www/revenue
cd /var/www/revenue/backend

# .env anlegen
cp .env.example .env
nano .env   # DB-Zugangsdaten + JWT_SECRET eintragen

# Abhängigkeiten installieren
npm install --production

# Mit PM2 als Dienst starten:
npm install -g pm2
pm2 start src/app.js --name revenue-backend
pm2 save
pm2 startup
```

---

## 3. Frontend bauen & deployen

```bash
cd /var/www/revenue/frontend
npm install
npm run build
# Ergebnis liegt in frontend/dist/ → als Web-Root konfigurieren
```

---

## 4. Nginx konfigurieren

```nginx
server {
    listen 80;
    server_name ihre-domain.de;

    # Frontend (React SPA)
    root /var/www/revenue/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 5. Erster Login

- URL: `https://ihre-domain.de`
- E-Mail: `info@workation-wolfsburg.com`
- Passwort: `Wmh2023#2026`

**Sofort nach dem ersten Login unter "Benutzer" weitere Accounts anlegen!**

---

## Lokale Entwicklung

```bash
# Terminal 1 – Backend
cd backend && npm install && cp .env.example .env
# .env bearbeiten (lokale MySQL-Daten)
npm run dev

# Terminal 2 – Frontend
cd frontend && npm install
npm run dev
# → http://localhost:5173
```
