import { supabase } from "@/integrations/supabase/client";
import { searchBrandfetchDomain } from "@/lib/brandfetch";

const BUCKET = "merchant-logos";
const CACHE_NAME = "merchant-logos-v1";

/**
 * Sanitizes a store name into a safe filename for the Supabase bucket.
 * e.g. "YouTube Premium" → "youtube-premium.png"
 *      "McDonald's"     → "mcdonalds.png"
 */
export function sanitizeStoreName(store: string): string {
  return (
    store
      .trim()
      .toLowerCase()
      .replace(/['''`]/g, "")  // strip apostrophes/quotes before hyphenating
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  ) + ".png";
}

/**
 * Checks if a logo exists in the browser's Cache Storage.
 * Returns a blob URL string if found, null otherwise.
 * The caller is responsible for calling URL.revokeObjectURL on the returned URL.
 */
export async function getLogoFromLocalCache(store: string): Promise<string | null> {
  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const filename = sanitizeStoreName(store);
    const response = await cache.match(`/${filename}`);
    if (response) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch {
    // ignore cache errors silently
  }
  return null;
}

/**
 * Saves a logo blob to the browser's Cache Storage.
 */
export async function saveLogoToLocalCache(store: string, blob: Blob): Promise<void> {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const filename = sanitizeStoreName(store);
    await cache.put(
      `/${filename}`,
      new Response(blob, { headers: { "Content-Type": blob.type || "image/png" } }),
    );
  } catch {
    // ignore cache errors silently
  }
}

/**
 * Returns the public URL for a logo in Supabase Storage if the file exists,
 * or null if it does not.
 */
export async function getLogoFromSupabase(store: string): Promise<string | null> {
  const filename = sanitizeStoreName(store);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  if (!data?.publicUrl) return null;
  try {
    const resp = await fetch(data.publicUrl, { method: "HEAD" });
    if (resp.ok) return data.publicUrl;
  } catch {
    // network error – treat as not found
  }
  return null;
}

/**
 * Downloads an image from the given URL as a Blob, uploads it to the
 * merchant-logos Supabase Storage bucket, caches it locally, and returns
 * the public URL. Returns null on failure.
 */
export async function uploadLogoToSupabase(
  store: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    const filename = sanitizeStoreName(store);
    const contentType = blob.type || "image/png";
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filename, blob, { contentType, upsert: true });
    if (error) {
      console.warn("[MerchantLogo] Supabase upload error:", error.message);
      return null;
    }
    // Save to local cache after successful upload
    await saveLogoToLocalCache(store, blob);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.warn("[MerchantLogo] Upload failed:", err);
    return null;
  }
}

/**
 * Updates the merchant_logo_url field on all lancamentos rows that share
 * the given store name (loja).
 */
export async function saveMerchantLogoUrl(
  store: string,
  logoUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from("lancamentos")
    .update({ merchant_logo_url: logoUrl })
    .eq("loja", store);
  if (error) {
    console.warn("[MerchantLogo] DB update error:", error.message);
  }
}

/**
 * Scans all of the user's lancamentos that have a store name (loja) but no
 * merchant_logo_url, and retroactively resolves + saves logos for them.
 *
 * Resolution order per unique store:
 *   1. Supabase Storage (logo already uploaded by another session)
 *   2. Brandfetch Search → Brandfetch CDN / Clearbit → upload to Supabase
 *   3. Google Favicon → upload to Supabase
 *
 * @param userId    The authenticated user's id (used to scope the query).
 * @param onProgress  Optional callback called after each store is processed.
 *                    Receives (doneCount, totalCount, currentStoreName).
 * @returns Object with { processed, succeeded, failed } counts.
 */
export async function backfillMerchantLogos(
  userId: string,
  onProgress?: (done: number, total: number, currentStore: string) => void,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  // Fetch all lancamentos with a store name but no logo URL for this user.
  const { data, error } = await supabase
    .from("lancamentos")
    .select("loja")
    .eq("user_id", userId)
    .not("loja", "is", null)
    .neq("loja", "")
    .is("merchant_logo_url", null);

  if (error) {
    console.warn("[backfillMerchantLogos] Query error:", error.message);
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  // Deduplicate store names so we only hit the APIs once per unique store.
  const stores = [
    ...new Set((data ?? []).map((r) => r.loja as string).filter(Boolean)),
  ];
  const total = stores.length;
  let succeeded = 0;
  let failed = 0;

  const rawClientId = import.meta.env.VITE_BRANDFETCH_CLIENT_ID;
  const clientId = rawClientId
    ? String(rawClientId).replace(/[^a-zA-Z0-9-]/g, "")
    : null;

  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    onProgress?.(i, total, store);

    try {
      // Step 1: Check Supabase Storage (already uploaded by another session).
      const supabaseUrl = await getLogoFromSupabase(store);
      if (supabaseUrl) {
        await saveMerchantLogoUrl(store, supabaseUrl);
        succeeded++;
        continue;
      }

      // Step 2: Resolve via external APIs.
      const domain = await searchBrandfetchDomain(store);
      let externalUrl: string;
      if (domain) {
        externalUrl = clientId
          ? `https://cdn.brandfetch.io/${domain}/w/56/h/56?c=${clientId}`
          : `https://logo.clearbit.com/${domain}`;
      } else {
        externalUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(store)}&sz=128`;
      }

      // Upload to Supabase Storage (also caches locally).
      const publicUrl = await uploadLogoToSupabase(store, externalUrl);
      if (publicUrl) {
        await saveMerchantLogoUrl(store, publicUrl);
        succeeded++;
      } else {
        failed++;
      }
    } catch (err) {
      console.warn(`[backfillMerchantLogos] Failed for "${store}":`, err);
      failed++;
    }
  }

  onProgress?.(total, total, "");
  return { processed: total, succeeded, failed };
}
