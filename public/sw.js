// Gil Financeiro — Service Worker (Share Target)
// Intercepts the OS share-sheet POST and makes the shared file/text
// available to the SPA via Cache API, then redirects to /?share=1.

const SHARE_CACHE = 'pending-share-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ── 1. Handle the share-target POST from the OS share sheet ────────────────
  if (url.pathname === '/share-target' && request.method === 'POST') {
    event.respondWith(handleShareTarget(request));
    return;
  }

  // ── 2. Serve cached file back to the app ──────────────────────────────────
  if (url.pathname === '/_share/file' && request.method === 'GET') {
    event.respondWith(
      caches.open(SHARE_CACHE)
        .then((c) => c.match('file'))
        .then((r) => r ?? new Response(null, { status: 404 }))
    );
    return;
  }

  // ── 3. Serve cached metadata (text) back to the app ───────────────────────
  if (url.pathname === '/_share/meta' && request.method === 'GET') {
    event.respondWith(
      caches.open(SHARE_CACHE)
        .then((c) => c.match('meta'))
        .then((r) => r ?? new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
    );
    return;
  }

  // ── 4. Clear cached share data after the app has consumed it ──────────────
  if (url.pathname === '/_share/clear' && request.method === 'POST') {
    event.respondWith(
      caches.open(SHARE_CACHE).then(async (c) => {
        await Promise.all([c.delete('file'), c.delete('meta')]);
        return new Response(null, { status: 204 });
      })
    );
    return;
  }
});

async function handleShareTarget(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.redirect('/', 303);
  }

  const file = formData.get('file');
  const text = [
    formData.get('title') ?? '',
    formData.get('text') ?? '',
    formData.get('url') ?? '',
  ].filter(Boolean).join(' ').trim();

  const cache = await caches.open(SHARE_CACHE);

  // Store the file (image or PDF) in the cache
  if (file instanceof File && file.size > 0) {
    await cache.put('file', new Response(file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
      },
    }));
  } else {
    await cache.delete('file');
  }

  // Store text metadata (bank notification text, title, URL)
  await cache.put('meta', new Response(
    JSON.stringify({ text, hasFile: file instanceof File && file.size > 0 }),
    { headers: { 'Content-Type': 'application/json' } }
  ));

  return Response.redirect('/?share=1', 303);
}
