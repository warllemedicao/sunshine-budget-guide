const SHARE_CACHE = 'share-target-v1';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const file = formData.get('receipt');

        if (file instanceof File && file.size > 0) {
          const cache = await caches.open(SHARE_CACHE);
          await cache.put(
            '/shared-receipt',
            new Response(file, {
              headers: {
                'Content-Type': file.type || 'application/octet-stream',
                'X-File-Name': encodeURIComponent(file.name || 'comprovante'),
              },
            })
          );
        }

        return Response.redirect('/?share=true', 303);
      })()
    );
  }
});
