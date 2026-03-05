import { supabase } from "@/integrations/supabase/client";

const BUCKET = "merchant-logos";
const CACHE_NAME = "merchant-logos-v1";

// ---------------------------------------------------------------------------
// Name normalisation
// ---------------------------------------------------------------------------

/**
 * Normalises a store name into a canonical key used to deduplicate merchants.
 *
 * Rules applied (in order):
 *  1. Trim whitespace
 *  2. Lowercase
 *  3. Remove accents (NFD decomposition)
 *  4. Remove apostrophes / quotes before other character stripping
 *  5. Remove common business suffixes (.com, ltda, s/a, sa, inc, corp)
 *  6. Strip remaining non-alphanumeric characters (including spaces)
 *
 * Examples:
 *   "Mc Donald's"  → "mcdonalds"
 *   "MC DONALDS"   → "mcdonalds"
 *   "Amazon.com"   → "amazon"
 *   "Lojas Ltda"   → "lojas"
 */
export function normalizeMerchantName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    // Remove accents
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Remove apostrophes / quotes so "McDonald's" → "McDonalds" before suffix removal
    .replace(/['''`"]/g, "")
    // Remove common business suffixes (whole-word match)
    .replace(/\b(\.com|ltda|s\/a|sa|inc|corp)\b/g, "")
    // Strip everything that is not a letter or digit (including spaces)
    .replace(/[^a-z0-9]/g, "");
}

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

// ---------------------------------------------------------------------------
// Merchant DB helpers
// ---------------------------------------------------------------------------

export interface MerchantRecord {
  id: string;
  name: string;
  normalized_name: string;
  domain: string | null;
  logo_url: string | null;
  logo_storage_path: string | null;
}

/**
 * Returns an existing merchant by normalised name, or null if none exists.
 */
export async function getMerchantByNormalizedName(
  normalizedName: string,
): Promise<MerchantRecord | null> {
  const { data } = await supabase
    .from("merchants")
    .select("id, name, normalized_name, domain, logo_url, logo_storage_path")
    .eq("normalized_name", normalizedName)
    .maybeSingle();
  return data ?? null;
}

/**
 * Returns an existing merchant by its UUID, or null if none exists.
 * Used in BrandLogo when the parent already holds the merchant_id so we can
 * skip the name-normalisation lookup and query by PK directly.
 */
export async function getMerchantById(
  id: string,
): Promise<MerchantRecord | null> {
  const { data } = await supabase
    .from("merchants")
    .select("id, name, normalized_name, domain, logo_url, logo_storage_path")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

/**
 * Finds an existing merchant by store name (after normalisation) or creates a
 * new one.  Returns the merchant record.
 *
 * On unique-constraint conflict (race condition) the function retries the
 * SELECT so callers always receive the canonical merchant.
 */
export async function findOrCreateMerchant(
  name: string,
): Promise<MerchantRecord> {
  const normalizedName = normalizeMerchantName(name);

  // 1. Try to find an existing merchant
  const existing = await getMerchantByNormalizedName(normalizedName);
  if (existing) return existing;

  // 2. Insert a new merchant
  const { data: created, error } = await supabase
    .from("merchants")
    .insert({ name, normalized_name: normalizedName })
    .select("id, name, normalized_name, domain, logo_url, logo_storage_path")
    .single();

  if (!error && created) return created as MerchantRecord;

  // 3. Handle race condition: another process may have inserted concurrently
  const retry = await getMerchantByNormalizedName(normalizedName);
  if (retry) return retry;

  throw error ?? new Error("[Merchant] Failed to find or create merchant");
}

/**
 * Updates `logo_url` and optionally `domain` for a merchant record.
 */
export async function updateMerchantLogo(
  merchantId: string,
  logoUrl: string,
  domain?: string | null,
): Promise<void> {
  const update: { logo_url: string; domain?: string } = { logo_url: logoUrl };
  if (domain) update.domain = domain;
  const { error } = await supabase
    .from("merchants")
    .update(update)
    .eq("id", merchantId);
  if (error) {
    console.warn("[MerchantLogo] merchants update error:", error.message);
  }
}

/**
 * Propagates a resolved logo URL to ALL lancamentos that share the same
 * merchant_id.  Also falls back to updating by loja name for legacy rows
 * that pre-date the merchant_id column.
 */
export async function saveMerchantLogoUrl(
  store: string,
  logoUrl: string,
  merchantId?: string,
): Promise<void> {
  // Update via merchant_id (preferred — covers all related lancamentos)
  if (merchantId) {
    const { error } = await supabase
      .from("lancamentos")
      .update({ merchant_logo_url: logoUrl })
      .eq("merchant_id", merchantId);
    if (error) {
      console.warn("[MerchantLogo] DB update via merchant_id error:", error.message);
    }
    // Also update the merchants table logo_url
    await updateMerchantLogo(merchantId, logoUrl);
  }

  // Legacy fallback: update rows that still use loja name but have no merchant_id
  const { error } = await supabase
    .from("lancamentos")
    .update({ merchant_logo_url: logoUrl })
    .eq("loja", store)
    .is("merchant_id", null);
  if (error) {
    console.warn("[MerchantLogo] DB update via loja error:", error.message);
  }
}

// ---------------------------------------------------------------------------
// Cache Storage helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Supabase Storage helpers
// ---------------------------------------------------------------------------

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
  merchantId?: string,
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
    const publicUrl = data?.publicUrl ?? null;
    if (publicUrl && merchantId) {
      // Persist logo_url to the merchants table so future loads skip the API
      await updateMerchantLogo(merchantId, publicUrl);
    }
    return publicUrl;
  } catch (err) {
    console.warn("[MerchantLogo] Upload failed:", err);
    return null;
  }
}

