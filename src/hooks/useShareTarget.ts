import { useEffect, useState } from 'react';

const SHARE_CACHE = 'share-target-v1';

/**
 * Detects when the app was opened via the Web Share Target API.
 * Reads the shared file from Cache API and returns it for pre-loading.
 */
export const useShareTarget = () => {
  const [sharedFile, setSharedFile] = useState<File | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('share')) return;

    // Remove the ?share param from the URL without triggering a navigation
    const cleanUrl = window.location.pathname;
    window.history.replaceState(null, '', cleanUrl);

    if (!('caches' in window)) return;

    caches.open(SHARE_CACHE).then(async (cache) => {
      const response = await cache.match('/shared-receipt');
      if (!response) return;

      const blob = await response.blob();
      const rawName = response.headers.get('X-File-Name') || 'comprovante';
      const fileName = decodeURIComponent(rawName);

      await cache.delete('/shared-receipt');

      if (blob.size > 0) {
        setSharedFile(new File([blob], fileName, { type: blob.type }));
      }
    }).catch((err) => {
      console.warn('Share target: failed to read shared file from cache', err);
    });
  }, []);

  const clearSharedFile = () => setSharedFile(null);

  return { sharedFile, clearSharedFile };
};
