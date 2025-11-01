/**
 * Cloudflare Worker Proxy für Nextcloud WebDAV/OCS API
 *
 * Dieser Worker leitet alle Anfragen an deinen Nextcloud Server weiter
 * und fügt die notwendigen CORS Header hinzu.
 */

// KONFIGURATION - Ersetze mit deiner Nextcloud URL
const NEXTCLOUD_URL = 'https://cloud.bechtel-druck.de';

// Erlaubte Origins (WeWeb Editor + deine App)
const ALLOWED_ORIGINS = [
  'https://editor.weweb.io',
  // Füge hier deine publizierte WeWeb App Domain hinzu:
  // 'https://deine-app.weweb.app',
  // Oder erlaube alle (nicht empfohlen für Produktion):
  // '*'
];

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');

  // CORS Preflight (OPTIONS) Request
  if (request.method === 'OPTIONS') {
    return handleCORS(origin);
  }

  try {
    // Erstelle die Nextcloud URL
    const nextcloudUrl = NEXTCLOUD_URL + url.pathname + url.search;

    // Kopiere alle Header vom Original Request
    const headers = new Headers(request.headers);

    // Entferne Host Header (wird automatisch gesetzt)
    headers.delete('Host');
    headers.delete('Origin');

    // Erstelle die Anfrage an Nextcloud
    const nextcloudRequest = new Request(nextcloudUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : undefined,
    });

    // Sende Anfrage an Nextcloud
    const response = await fetch(nextcloudRequest);

    // Kopiere Response Headers
    const responseHeaders = new Headers(response.headers);

    // Füge CORS Headers hinzu
    if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
      responseHeaders.set('Access-Control-Allow-Origin', origin || '*');
      responseHeaders.set('Access-Control-Allow-Credentials', 'true');
      responseHeaders.set('Access-Control-Expose-Headers', '*');
    }

    // Erstelle neue Response mit CORS Headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Proxy Error',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin || '*',
      },
    });
  }
}

function handleCORS(origin) {
  const headers = new Headers();

  if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin || '*');
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, COPY, MOVE');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Depth, OCS-APIRequest, X-Requested-With, Content-Length');
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(null, {
    status: 204,
    headers: headers,
  });
}
