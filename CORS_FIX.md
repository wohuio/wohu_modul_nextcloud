# Nextcloud CORS Fehler beheben

## Problem
Das WeWeb Element kann keine Verbindung zu Nextcloud herstellen wegen CORS (Cross-Origin Resource Sharing) Policy.

**Fehler:**
```
Access to fetch at 'https://cloud.bechtel-druck.de/remote.php/dav/files/...'
from origin 'https://editor.weweb.io' has been blocked by CORS policy
```

## Ursache
Der Nextcloud Server erlaubt keine Anfragen von `https://editor.weweb.io` (bzw. von deiner WeWeb App Domain).

## Lösungen

### Option 1: CORS Header in Nextcloud konfigurieren (Empfohlen für Produktion)

Füge die CORS Header in der Nextcloud `.htaccess` oder in der Webserver-Konfiguration hinzu:

**Apache (.htaccess in Nextcloud root):**
```apache
<IfModule mod_headers.c>
    # Erlaube Anfragen von WeWeb Editor
    Header always set Access-Control-Allow-Origin "https://editor.weweb.io"

    # Für deine eigene WeWeb App Domain (ersetze mit deiner Domain):
    # Header always set Access-Control-Allow-Origin "https://deine-app.weweb.app"

    # Oder erlaube alle Domains (NICHT für Produktion empfohlen!):
    # Header always set Access-Control-Allow-Origin "*"

    Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL"
    Header always set Access-Control-Allow-Headers "Authorization, Content-Type, Depth, OCS-APIRequest"
    Header always set Access-Control-Allow-Credentials "true"
    Header always set Access-Control-Max-Age "3600"
</IfModule>
```

**Nginx:**
```nginx
location ~ ^/remote\.php/dav {
    add_header 'Access-Control-Allow-Origin' 'https://editor.weweb.io' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Depth, OCS-APIRequest' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;

    if ($request_method = 'OPTIONS') {
        return 204;
    }
}
```

### Option 2: Proxy Server verwenden (Schnelle Lösung für Entwicklung)

Erstelle einen Backend-Proxy, der die Nextcloud Anfragen weiterleitet:

1. **Node.js Proxy** (mit Express + http-proxy-middleware)
2. **Cloudflare Workers** (serverless proxy)
3. **WeWeb Backend Workflow** mit HTTP Request Action

**Beispiel Node.js Proxy:**
```javascript
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
app.use(cors());

app.use('/nextcloud', createProxyMiddleware({
  target: 'https://cloud.bechtel-druck.de',
  changeOrigin: true,
  pathRewrite: {
    '^/nextcloud': '',
  },
  onProxyReq: (proxyReq, req) => {
    // Leite Authorization Header weiter
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }
  },
}));

app.listen(3000);
```

Dann in WeWeb: `serverUrl = "https://dein-proxy.com/nextcloud"`

### Option 3: Nextcloud App "CORS" installieren

Es gibt eine Nextcloud App die CORS automatisch konfiguriert:

1. In Nextcloud als Admin einloggen
2. Apps → Suche nach "CORS" oder "WebDAV CORS"
3. App installieren und konfigurieren
4. Füge `https://editor.weweb.io` zu den erlaubten Origins hinzu

### Option 4: Nur für Entwicklung - Browser CORS deaktivieren

**NUR FÜR TESTS! NICHT FÜR PRODUKTION!**

Chrome mit deaktivierten CORS starten:
```bash
# Mac
open -na Google\ Chrome --args --disable-web-security --user-data-dir=/tmp/chrome_dev

# Windows
chrome.exe --disable-web-security --user-data-dir=C:\temp\chrome_dev

# Linux
google-chrome --disable-web-security --user-data-dir=/tmp/chrome_dev
```

## Empfohlener Workflow

1. **Für Entwicklung/Testing:** Option 4 (Browser CORS aus)
2. **Für Staging:** Option 2 (Proxy Server)
3. **Für Produktion:** Option 1 (Nextcloud CORS Header konfigurieren)

## Testing nach der Konfiguration

Nach der CORS-Konfiguration:

1. Leere den Browser Cache
2. Lade WeWeb Editor neu
3. Konfiguriere das Element mit:
   - Server URL: `https://cloud.bechtel-druck.de`
   - Username: `p.keller@bechtel-druck.de`
   - App Password: (dein Nextcloud App Passwort)

Die Console Logs sollten jetzt zeigen:
```
Loading directory: /
Server URL: https://cloud.bechtel-druck.de
Username: p.keller@bechtel-druck.de
Loaded items: X
```

## Nextcloud App Password erstellen

Falls noch nicht vorhanden:

1. In Nextcloud einloggen
2. Einstellungen → Sicherheit
3. Unter "Geräte & Sitzungen" → "Neues App-Passwort erstellen"
4. Name: z.B. "WeWeb File Manager"
5. Token kopieren und in WeWeb verwenden

## Support

Falls Probleme bestehen bleiben:
- Überprüfe Nextcloud Logs: `data/nextcloud.log`
- Überprüfe Webserver Logs (Apache/Nginx)
- Teste mit `curl` von der Kommandozeile:

```bash
curl -X PROPFIND \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)" \
  -H "Depth: 1" \
  https://cloud.bechtel-druck.de/remote.php/dav/files/username/
```
