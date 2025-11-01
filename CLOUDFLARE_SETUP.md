# Cloudflare Worker Proxy Setup für Nextcloud

## Warum ein Proxy?

Deine Nextcloud ist bei Hetzner gehostet (Managed Service) und du hast keinen direkten Zugriff auf `.htaccess` oder Webserver-Konfiguration. Der Cloudflare Worker fungiert als Proxy zwischen WeWeb und Nextcloud und fügt die notwendigen CORS Header hinzu.

## Schritt-für-Schritt Anleitung

### 1. Cloudflare Account erstellen (falls noch nicht vorhanden)

1. Gehe zu https://dash.cloudflare.com/sign-up
2. Registriere dich (kostenlos)
3. Bestätige deine E-Mail

### 2. Cloudflare Worker erstellen

1. Logge dich in Cloudflare ein
2. Klicke auf **"Workers & Pages"** im linken Menü
3. Klicke auf **"Create application"**
4. Wähle **"Create Worker"**
5. Gib einen Namen ein: z.B. `nextcloud-proxy`
6. Klicke auf **"Deploy"**

### 3. Worker Code einfügen

1. Nach dem Deploy klicke auf **"Edit code"**
2. Lösche den Standard-Code komplett
3. Kopiere den gesamten Code aus `cloudflare-worker-proxy.js`
4. Füge ihn in den Editor ein
5. **WICHTIG:** Ändere in Zeile 9:
   ```javascript
   const NEXTCLOUD_URL = 'https://cloud.bechtel-druck.de';
   ```
6. Klicke oben rechts auf **"Save and Deploy"**

### 4. Worker URL notieren

Nach dem Deploy siehst du die Worker URL, z.B.:
```
https://nextcloud-proxy.dein-account.workers.dev
```

**Notiere diese URL!** Das ist deine neue Proxy-URL.

### 5. WeWeb Element konfigurieren

Gehe in WeWeb und konfiguriere das Nextcloud Element:

**ALT (funktioniert nicht wegen CORS):**
```
Server URL: https://cloud.bechtel-druck.de
```

**NEU (mit Proxy - funktioniert!):**
```
Server URL: https://nextcloud-proxy.dein-account.workers.dev
Username: p.keller@bechtel-druck.de
App Password: [dein Nextcloud App-Passwort]
```

### 6. Testen

1. Speichere die Konfiguration in WeWeb
2. Das Element sollte jetzt verbinden und Dateien anzeigen
3. Schaue in die Browser Console - die Logs sollten zeigen:
   ```
   Loading directory: /
   Server URL: https://nextcloud-proxy.xxx.workers.dev
   Username: p.keller@bechtel-druck.de
   Loaded items: X
   ```

## Optional: Custom Domain verwenden

Statt `xxx.workers.dev` kannst du auch eine eigene Domain verwenden:

### Option 1: Subdomain von bestehender Domain (empfohlen)

Falls du bereits eine Domain in Cloudflare hast (z.B. `bechtel-druck.de`):

1. Gehe zu deinem Worker
2. Klicke auf **"Triggers"** Tab
3. Unter **"Custom Domains"** klicke **"Add Custom Domain"**
4. Gib eine Subdomain ein: z.B. `nextcloud-api.bechtel-druck.de`
5. Klicke **"Add Custom Domain"**

Dann verwendest du in WeWeb:
```
Server URL: https://nextcloud-api.bechtel-druck.de
```

### Option 2: Neue Domain kaufen

1. Kaufe eine günstige Domain (z.B. bei Cloudflare Registrar)
2. Füge sie zu Cloudflare hinzu
3. Nutze dann Option 1 mit einer Subdomain

## Sicherheits-Hinweise

### 1. ALLOWED_ORIGINS einschränken

In der Worker-Datei, Zeile 11-16:

```javascript
const ALLOWED_ORIGINS = [
  'https://editor.weweb.io',
  // Füge hier deine publizierte WeWeb App hinzu:
  'https://deine-app.weweb.app',
];
```

**WICHTIG:** Wenn du deine WeWeb App publizierst, füge die Domain hier hinzu!

### 2. Rate Limiting (optional)

Cloudflare bietet automatisches Rate Limiting. Für zusätzlichen Schutz kannst du in den Worker Settings:

1. Gehe zu **"Settings"** → **"Triggers"**
2. Aktiviere **"Rate Limiting"**
3. Setze z.B. 1000 Requests pro Minute

### 3. IP Whitelist (optional, fortgeschritten)

Falls du nur von bestimmten IPs erlauben willst, füge am Anfang von `handleRequest` hinzu:

```javascript
const clientIP = request.headers.get('CF-Connecting-IP');
const allowedIPs = ['1.2.3.4', '5.6.7.8'];

if (!allowedIPs.includes(clientIP)) {
  return new Response('Forbidden', { status: 403 });
}
```

## Kosten

**Cloudflare Workers Free Tier:**
- 100.000 Requests pro Tag: **Kostenlos**
- Weltweit verteilt (Edge Network)
- Keine Kreditkarte erforderlich

**Cloudflare Workers Paid Plan ($5/Monat):**
- 10 Millionen Requests pro Monat
- Unbegrenzte Worker
- Längere CPU-Zeit

Für dein Nextcloud File Manager Element reicht der Free Tier vollkommen aus!

## Troubleshooting

### Worker funktioniert nicht

1. **Überprüfe die Worker URL:**
   - Öffne `https://dein-worker.workers.dev` im Browser
   - Du solltest eine Nextcloud Login-Seite sehen (oder 404)

2. **Überprüfe NEXTCLOUD_URL in Worker:**
   ```javascript
   const NEXTCLOUD_URL = 'https://cloud.bechtel-druck.de';
   ```
   - KEINE trailing slash `/` am Ende
   - HTTPS (nicht HTTP)

3. **Überprüfe Browser Console:**
   - F12 → Console Tab
   - Schaue nach Fehler-Meldungen

### "Unauthorized" Fehler

- **Problem:** App-Passwort ist falsch oder abgelaufen
- **Lösung:** Erstelle neues App-Passwort in Nextcloud
  1. Nextcloud → Einstellungen → Sicherheit
  2. "Neues App-Passwort erstellen"
  3. Name: "WeWeb Cloudflare Proxy"
  4. Kopiere Token und verwende in WeWeb

### Worker Logs ansehen

1. Gehe zu deinem Worker in Cloudflare Dashboard
2. Klicke auf **"Logs"** Tab
3. Aktiviere **"Begin log stream"**
4. Teste das Element in WeWeb
5. Schaue die Live-Logs an

### Response zu groß

Falls du sehr viele Dateien hast (>1000) und der Worker timeout hat:

1. In WeWeb: Nutze Pagination
2. Oder erhöhe Worker Limits im Paid Plan

## Support

Bei Problemen:
1. Schaue in Cloudflare Worker Logs
2. Schaue in Browser Console
3. Teste Worker URL direkt im Browser
4. Überprüfe Nextcloud App-Passwort

## Nächste Schritte nach Setup

1. ✅ Worker erstellt und deployed
2. ✅ WeWeb Element mit Proxy-URL konfiguriert
3. ✅ Testen: Dateien hochladen, herunterladen, löschen
4. ✅ WeWeb App publizieren
5. ⚠️ **WICHTIG:** Publizierte App-Domain zu `ALLOWED_ORIGINS` hinzufügen!

## Alternative: Hetzner Support

Falls du den Proxy nicht nutzen möchtest, kannst du auch Hetzner kontaktieren und bitten, CORS direkt auf dem Server zu aktivieren. Das wäre die "sauberste" Lösung, dauert aber 1-2 Tage bis der Support antwortet.

Support-Ticket Text findest du in `CORS_FIX.md` → Option 1.
