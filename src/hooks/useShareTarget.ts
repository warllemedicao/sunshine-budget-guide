import { useEffect, useRef, useState } from 'react';

const SHARE_CACHE = 'share-target-v1';

interface NativeSharedFilePayload {
  id: string;
  name: string;
  mimeType: string;
  base64Data: string;
}

interface ShareReceiverPlugin {
  getPendingShare(): Promise<{ file: NativeSharedFilePayload | null }>;
  addListener(
    eventName: 'shareIntentReceived',
    listenerFunc: (payload: { file: NativeSharedFilePayload | null }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}


const decodeBase64ToFile = (payload: NativeSharedFilePayload): File => {
  const binary = window.atob(payload.base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], payload.name || 'comprovante', {
    type: payload.mimeType || 'application/octet-stream',
  });
};

/**
 * Detects when the app was opened via the Web Share Target API.
 * Reads the shared file from Cache API and returns it for pre-loading.
 */
export const useShareTarget = () => {
  const [sharedFile, setSharedFile] = useState<File | null>(null);
  const lastNativeShareId = useRef<string | null>(null);

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
          console.info("[Share target] Arquivo web carregado do cache", {
            fileName,
            type: blob.type,
            size: blob.size,
          });
          setSharedFile(new File([blob], fileName, { type: blob.type }));
        }
      } catch (err) {
        console.warn('Share target: failed to read shared file from cache', err);
      }
    };

    const applyNativeSharedFile = (payload: NativeSharedFilePayload | null) => {
      if (!payload?.base64Data || lastNativeShareId.current === payload.id) return;
      lastNativeShareId.current = payload.id;
      try {
        console.info("[Share target] Arquivo nativo recebido", {
          id: payload.id,
          name: payload.name,
          mimeType: payload.mimeType,
        });
        setSharedFile(decodeBase64ToFile(payload));
      } catch (err) {
        console.warn('Share target: failed to decode native shared file', err);
      }
    };

    const setupNativeShareListener = async () => {
      try {
        const { registerPlugin } = await import('@capacitor/core');
        const ShareReceiver = registerPlugin<ShareReceiverPlugin>('ShareReceiver');
        const pending = await ShareReceiver.getPendingShare();
        applyNativeSharedFile(pending.file);

        const listener = await ShareReceiver.addListener('shareIntentReceived', ({ file }) => {
          applyNativeSharedFile(file);
        });

        return () => {
          void listener.remove();
        };
      } catch (err) {
        console.warn('Share target: native share receiver unavailable', err);
        return undefined;
      }
    };

    const params = new URLSearchParams(window.location.search);
    const isShareRoute = window.location.pathname === '/share-target';
    const hasShareFlag = params.has('share');
    if (isShareRoute || hasShareFlag) {
      console.info("[Share target] URL de compartilhamento detectada", {
        pathname: window.location.pathname,
        hasShareFlag,
      });
      // Normalize the URL without triggering a navigation.
      window.history.replaceState(null, '', '/');
    }

    const handlePageShow = () => {
      void tryReadSharedReceipt();
    };

    void tryReadSharedReceipt();
    window.addEventListener('pageshow', handlePageShow);

    let cleanupNativeListener: (() => void) | undefined;
    setupNativeShareListener().then((cleanup) => {
      cleanupNativeListener = cleanup;
    });

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      cleanupNativeListener?.();
    };
  }, []);

  const clearSharedFile = () => setSharedFile(null);

  return { sharedFile, clearSharedFile };
};
