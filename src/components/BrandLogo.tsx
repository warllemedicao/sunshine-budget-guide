import { useState, useEffect, useRef } from "react";
import { searchBrandfetchDomain } from "@/lib/brandfetch";
import {
  getLogoFromLocalCache,
  getLogoFromSupabase,
  saveLogoToLocalCache,
  uploadLogoToSupabase,
  saveMerchantLogoUrl,
} from "@/lib/merchantLogo";

interface BrandLogoProps {
  store: string;
  /** Icon shown when no logo is available. If omitted the component renders nothing on failure. */
  fallbackIcon?: React.ReactNode;
  /** Background colour for the fallback container. */
  fallbackBg?: string;
  /** Size in pixels (width = height). Defaults to 28 (7 × 4 px). */
  size?: number;
  /** Pre-resolved logo URL. When provided the component renders it immediately without any cache or API lookup. */
  initialUrl?: string | null;
  /** Called whenever a logo URL is resolved (including via initialUrl). Useful for the parent to persist the URL. */
  onLogoResolved?: (url: string | null) => void;
}

/**
 * BrandLogo: shows a brand logo for a store/company name.
 *
 * Resolution priority (offline-first):
 *   1. Browser Cache Storage (no network)
 *   2. Supabase Storage public URL (one HEAD request)
 *   3. External APIs: Brandfetch CDN / Clearbit → Google Favicon
 *   4. fallbackIcon (category icon) or nothing
 *
 * When a logo is resolved via an external API it is uploaded to Supabase
 * Storage, saved to local Cache Storage, and the merchant_logo_url field is
 * updated for all matching lancamentos rows — all in the background so the
 * UI is not blocked.
 */
const BrandLogo = ({ store, fallbackIcon, fallbackBg, size = 28, initialUrl, onLogoResolved }: BrandLogoProps) => {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(!!store);
  // Track any blob URL we created so we can revoke it on cleanup.
  const blobUrlRef = useRef<string | null>(null);
  // Set to true when logoSrc comes from an external API (not local cache or Supabase).
  // Only external-sourced URLs should trigger the background upload to Supabase.
  const isExternalUrlRef = useRef(false);
  // Keep onLogoResolved in a ref so the main useEffect does not need it as a
  // dependency.  This prevents the effect from re-running when the parent
  // re-renders and passes a new (but functionally identical) callback reference.
  const onLogoResolvedRef = useRef(onLogoResolved);
  // Update the ref on every render so the effect always sees the latest value.
  onLogoResolvedRef.current = onLogoResolved;

  const getClientId = () => {
    const rawClientId = import.meta.env.VITE_BRANDFETCH_CLIENT_ID;
    return rawClientId ? String(rawClientId).replace(/[^a-zA-Z0-9-]/g, "") : null;
  };

  useEffect(() => {
    // Revoke any previous blob URL before starting a new resolution.
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    if (!store) {
      setLogoSrc(null);
      setFailed(false);
      setLoading(false);
      return;
    }
    setFailed(false);
    setLogoSrc(null);
    setLoading(true);

    // ── Fast path: use a pre-resolved URL supplied by the parent ─────────────
    // Blob URLs are session-specific and become invalid after a page refresh.
    // If the stored initialUrl is a stale blob (written by a previous bug),
    // skip the fast path so the logo is re-fetched through the normal pipeline.
    if (initialUrl && !initialUrl.startsWith("blob:")) {
      isExternalUrlRef.current = false;
      setLogoSrc(initialUrl);
      setLoading(false);
      onLogoResolvedRef.current?.(initialUrl);
      return;
    }

    let cancelled = false;

    (async () => {
      // ── Step 1: Browser Cache Storage (offline-first, no network) ──────────
      const cached = await getLogoFromLocalCache(store);
      if (cancelled) return;
      if (cached) {
        blobUrlRef.current = cached;
        isExternalUrlRef.current = false;
        setLogoSrc(cached);
        setLoading(false);
        // Do NOT call onLogoResolved with a session-specific blob URL.
        // Blob URLs are ephemeral — persisting them to the database would
        // cause logos to fail to load on any subsequent page refresh.
        return;
      }

      // ── Step 2: Supabase Storage public URL ────────────────────────────────
      const supabaseUrl = await getLogoFromSupabase(store);
      if (cancelled) return;
      if (supabaseUrl) {
        // Cache locally in the background for future offline access.
        fetch(supabaseUrl)
          .then((r) => r.blob())
          .then((b) => saveLogoToLocalCache(store, b))
          .catch((err) => console.warn("[MerchantLogo] Local cache write failed:", err));
        isExternalUrlRef.current = false;
        setLogoSrc(supabaseUrl);
        setLoading(false);
        onLogoResolvedRef.current?.(supabaseUrl);
        return;
      }

      // ── Step 3: External APIs ──────────────────────────────────────────────
      // Use Brandfetch Search to resolve the real domain first.
      const domain = await searchBrandfetchDomain(store);
      if (cancelled) return;

      const clientId = getClientId();
      let externalUrl: string;
      if (domain) {
        // A real domain was resolved — the CDN/Clearbit URL is a reliable,
        // persistent logo that is worth uploading to Supabase and saving to DB.
        externalUrl = clientId
          ? `https://cdn.brandfetch.io/${domain}/w/56/h/56?c=${clientId}`
          : `https://logo.clearbit.com/${domain}`;
        isExternalUrlRef.current = true;
      } else {
        // No domain found — use Google Favicon as a best-effort display
        // fallback but do NOT upload or persist the result.  The favicon
        // endpoint uses a store name (not a domain) so results are unreliable
        // and may be a generic globe icon.
        externalUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(store)}&sz=128`;
        isExternalUrlRef.current = false;
      }

      setLogoSrc(externalUrl);
      setLoading(false);
      // Only notify the parent (and persist) when we have a domain-resolved URL.
      if (domain) {
        onLogoResolvedRef.current?.(externalUrl);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [store, initialUrl]); // onLogoResolved intentionally omitted — tracked via onLogoResolvedRef

  const handleImageLoad = () => {
    // Only upload to Supabase when the logo was resolved via an external API.
    // Logos already served from Supabase or the local cache skip this step.
    if (!logoSrc || !isExternalUrlRef.current) return;
    uploadLogoToSupabase(store, logoSrc).then((publicUrl) => {
      if (publicUrl) saveMerchantLogoUrl(store, publicUrl);
    });
  };

  const handleError = () => {
    // All external URLs have been exhausted — show the category icon fallback.
    setFailed(true);
  };

  const style = { width: size, height: size };

  if (loading) {
    return (
      <div
        className="rounded-md flex-shrink-0 bg-muted animate-pulse"
        style={style}
      />
    );
  }

  if (failed || !logoSrc) {
    if (!fallbackIcon) return null;
    return (
      <div
        className="flex items-center justify-center rounded-md flex-shrink-0"
        style={{ ...style, backgroundColor: fallbackBg }}
      >
        {fallbackIcon}
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-md flex-shrink-0 overflow-hidden bg-white"
      style={style}
    >
      <img
        src={logoSrc}
        alt={store}
        className="h-full w-full object-contain"
        onLoad={handleImageLoad}
        onError={handleError}
      />
    </div>
  );
};

export default BrandLogo;

