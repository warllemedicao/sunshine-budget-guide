import { useEffect, useState } from 'react';

const SHARE_CACHE = 'share-target-v1';

/**
 * Detects when the app was opened via the Web Share Target API.
 * Reads the shared file from Cache API and returns it for pre-loading.
 */
export const useShareTarget = () => {
  const [sharedFile, setSharedFile] = useState<File | null>(null);

  useEffect(() => {
    const tryReadSharedReceipt = async () => {
      if (!('caches' in window)) return;

      try {
        const cache = await caches.open(SHARE_CACHE);
        const response = await cache.match('/shared-receipt');
        if (!response) return;

        const blob = await response.blob();
        const rawName = response.headers.get('X-File-Name') || 'comprovante';
        const fileName = decodeURIComponent(rawName);

        await cache.delete('/shared-receipt');

        if (blob.size > 0) {
          setSharedFile(new File([blob], fileName, { type: blob.type }));
        }
      } catch (err) {
        console.warn('Share target: failed to read shared file from cache', err);
      }
    };

    const params = new URLSearchParams(window.location.search);
    const isShareRoute = window.location.pathname === '/share-target';
    const hasShareFlag = params.has('share');
    if (isShareRoute || hasShareFlag) {
      // Normalize the URL without triggering a navigation.
      window.history.replaceState(null, '', '/');
    }

    const handlePageShow = () => {
      void tryReadSharedReceipt();
    };

    void tryReadSharedReceipt();
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const clearSharedFile = () => setSharedFile(null);

  return { sharedFile, clearSharedFile };
};
