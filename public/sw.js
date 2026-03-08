const SHARE_CACHE = 'share-target-v1';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        let file = formData.get('receipt');

        // Some apps send shared files with a different field name.
        if (!(file instanceof File)) {
          for (const value of formData.values()) {
            if (value instanceof File && value.size > 0) {
              file = value;
              break;
            }
          }
        }

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
