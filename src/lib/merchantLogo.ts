import { supabase } from "@/integrations/supabase/client";

const BUCKET = "merchant-logos";
const CACHE_NAME = "merchant-logos-v1";

/**
 * Normalizes a store name into a stable key for the merchants table.
 * e.g. "McDonald's" → "mcdonalds", "YouTube Premium" → "youtube-premium"
 */
export function normalizeMerchantName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['''`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Finds or creates a merchant record in the `merchants` table by normalized name.
 * Optionally updates domain and logo_url when better data becomes available.
 * Returns { id, logo_url } on success, or null on failure.
 */
export async function findOrCreateMerchant(
  name: string,
  domain?: string | null,
  logoUrl?: string | null,
): Promise<{ id: string; logo_url: string | null } | null> {
  const normalizedName = normalizeMerchantName(name);
  if (!normalizedName) return null;

  try {
    // Try to find an existing merchant record first.
    const { data: existing, error: selectError } = await supabase
      .from("merchants")
      .select("id, logo_url, domain")
      .eq("normalized_name", normalizedName)
      .maybeSingle();

    if (selectError) {
      console.warn("[Merchant] Lookup error:", selectError.message);
      return null;
    }

    if (existing) {
      // Patch in better data if we now have it (domain or logo) but the record doesn't.
      const updates: Record<string, unknown> = {};
      if (domain && !existing.domain) updates.domain = domain;
      if (logoUrl && !existing.logo_url) updates.logo_url = logoUrl;
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase.from("merchants").update(updates).eq("id", existing.id);
        if (updateError) {
          console.warn("[Merchant] Update error:", updateError.message);
        }
      }
      return { id: existing.id, logo_url: logoUrl ?? existing.logo_url };
    }

    // Insert a new merchant record.
    const { data: created, error: insertError } = await supabase
      .from("merchants")
      .insert({
        name: name.trim(),
        normalized_name: normalizedName,
        domain: domain ?? null,
        logo_url: logoUrl ?? null,
      })
      .select("id, logo_url")
      .single();

    if (insertError) {
      // Handle race condition: another client inserted the same normalized_name.
      if (insertError.code === "23505") {
        const { data: retry } = await supabase
          .from("merchants")
          .select("id, logo_url")
          .eq("normalized_name", normalizedName)
          .maybeSingle();
        return retry ? { id: retry.id, logo_url: retry.logo_url } : null;
      }
      console.warn("[Merchant] Insert error:", insertError.message);
      return null;
    }

    return created ? { id: created.id, logo_url: created.logo_url } : null;
  } catch (err) {
    console.warn("[Merchant] Unexpected error:", err);
    return null;
  }
}

/**
 * Looks up a merchant by its ID and returns the logo_url, or null if not found.
 */
export async function getMerchantLogoById(merchantId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("merchants")
      .select("logo_url")
      .eq("id", merchantId)
      .maybeSingle();
    if (error) {
      console.warn("[Merchant] ID lookup error:", error.message);
      return null;
    }
    return data?.logo_url ?? null;
  } catch (err) {
    console.warn("[Merchant] ID lookup unexpected error:", err);
    return null;
  }
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
 * Uploads a user-selected logo file to Supabase Storage and returns its public URL.
 * This is used as a manual fallback when external APIs cannot resolve a store logo.
 */
export async function uploadMerchantLogoFile(store: string, file: File): Promise<string | null> {
  try {
    const filename = sanitizeStoreName(store);
    const contentType = file.type || "image/png";
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filename, file, { contentType, upsert: true });

    if (error) {
      console.warn("[MerchantLogo] Manual upload error:", error.message);
      return null;
    }

    await saveLogoToLocalCache(store, file);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.warn("[MerchantLogo] Manual upload failed:", err);
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
