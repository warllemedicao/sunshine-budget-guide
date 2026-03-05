import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeMerchantName,
  sanitizeStoreName,
  getLogoFromLocalCache,
  saveLogoToLocalCache,
  getLogoFromSupabase,
  uploadLogoToSupabase,
  saveMerchantLogoUrl,
  findOrCreateMerchant,
  getMerchantByNormalizedName,
} from "@/lib/merchantLogo";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })) }));
const mockInsertSelect = vi.fn();
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }));
const mockEq = vi.fn(() => ({ error: null }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockIsNull = vi.fn(() => ({ error: null }));
const mockEqForNullCheck = vi.fn(() => ({ is: mockIsNull }));
const mockUpdateLegacy = vi.fn(() => ({ eq: mockEqForNullCheck }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: vi.fn(() => ({
          data: { publicUrl: "https://example.supabase.co/storage/v1/object/public/merchant-logos/youtube.png" },
        })),
        upload: vi.fn(() => ({ error: null })),
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "merchants") {
        return {
          select: mockSelect,
          insert: mockInsert,
          update: mockUpdate,
        };
      }
      // lancamentos table
      return {
        update: mockUpdateLegacy,
      };
    }),
  },
}));

// ---------------------------------------------------------------------------
// normalizeMerchantName
// ---------------------------------------------------------------------------

describe("normalizeMerchantName", () => {
  it("lowercases the name", () => {
    expect(normalizeMerchantName("AMAZON")).toBe("amazon");
  });

  it("removes spaces", () => {
    expect(normalizeMerchantName("You Tube")).toBe("youtube");
  });

  it("removes accents", () => {
    expect(normalizeMerchantName("Café Brasil")).toBe("cafebrasil");
  });

  it("removes apostrophes", () => {
    expect(normalizeMerchantName("McDonald's")).toBe("mcdonalds");
  });

  it("normalises 'Mc Donald's' to 'mcdonalds'", () => {
    expect(normalizeMerchantName("Mc Donald's")).toBe("mcdonalds");
  });

  it("normalises 'MC DONALDS' to 'mcdonalds'", () => {
    expect(normalizeMerchantName("MC DONALDS")).toBe("mcdonalds");
  });

  it("removes .com suffix", () => {
    expect(normalizeMerchantName("Amazon.com")).toBe("amazon");
  });

  it("removes ltda suffix", () => {
    expect(normalizeMerchantName("Lojas Ltda")).toBe("lojas");
  });

  it("removes s/a suffix", () => {
    expect(normalizeMerchantName("Empresa S/A")).toBe("empresa");
  });

  it("removes inc suffix", () => {
    expect(normalizeMerchantName("Google Inc")).toBe("google");
  });

  it("removes corp suffix", () => {
    expect(normalizeMerchantName("Microsoft Corp")).toBe("microsoft");
  });

  it("handles leading/trailing whitespace", () => {
    expect(normalizeMerchantName("  Netflix  ")).toBe("netflix");
  });
});

// ---------------------------------------------------------------------------
// sanitizeStoreName
// ---------------------------------------------------------------------------

describe("sanitizeStoreName", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(sanitizeStoreName("YouTube Premium")).toBe("youtube-premium.png");
  });

  it("removes leading/trailing hyphens", () => {
    expect(sanitizeStoreName("  Amazon  ")).toBe("amazon.png");
  });

  it("collapses consecutive special chars into a single hyphen", () => {
    expect(sanitizeStoreName("McDonald's")).toBe("mcdonalds.png");
  });

  it("preserves hyphens in compound names", () => {
    expect(sanitizeStoreName("Coca-Cola")).toBe("coca-cola.png");
  });

  it("appends .png extension", () => {
    expect(sanitizeStoreName("Netflix")).toBe("netflix.png");
  });
});

// ---------------------------------------------------------------------------
// getMerchantByNormalizedName
// ---------------------------------------------------------------------------

describe("getMerchantByNormalizedName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the merchant when found", async () => {
    const fakeMerchant = { id: "uuid-1", name: "Amazon", normalized_name: "amazon", domain: "amazon.com", logo_url: "https://logo.url", logo_storage_path: null };
    mockMaybeSingle.mockResolvedValue({ data: fakeMerchant });
    const result = await getMerchantByNormalizedName("amazon");
    expect(result).toEqual(fakeMerchant);
  });

  it("returns null when not found", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    const result = await getMerchantByNormalizedName("unknownbrand");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findOrCreateMerchant
// ---------------------------------------------------------------------------

describe("findOrCreateMerchant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing merchant without inserting", async () => {
    const existing = { id: "uuid-1", name: "Amazon", normalized_name: "amazon", domain: null, logo_url: null, logo_storage_path: null };
    mockMaybeSingle.mockResolvedValue({ data: existing });
    const result = await findOrCreateMerchant("Amazon");
    expect(result).toEqual(existing);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("creates a new merchant when one does not exist", async () => {
    const created = { id: "uuid-2", name: "Netflix", normalized_name: "netflix", domain: null, logo_url: null, logo_storage_path: null };
    // First call (select) returns null
    mockMaybeSingle.mockResolvedValue({ data: null });
    // Insert returns the new record
    mockInsertSelect.mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: created, error: null }),
    });
    const result = await findOrCreateMerchant("Netflix");
    expect(result).toEqual(created);
    expect(mockInsert).toHaveBeenCalledWith({ name: "Netflix", normalized_name: "netflix" });
  });

  it("retries select on insert conflict and returns existing merchant", async () => {
    const existing = { id: "uuid-3", name: "Spotify", normalized_name: "spotify", domain: null, logo_url: null, logo_storage_path: null };
    // First select returns null, insert fails, second select returns existing
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: existing });
    mockInsertSelect.mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "unique violation" } }),
    });
    const result = await findOrCreateMerchant("Spotify");
    expect(result).toEqual(existing);
  });
});

// ---------------------------------------------------------------------------
// Cache Storage helpers
// ---------------------------------------------------------------------------

describe("getLogoFromLocalCache / saveLogoToLocalCache", () => {
  const mockCache = {
    match: vi.fn(),
    put: vi.fn(),
  };

  beforeEach(() => {
    vi.stubGlobal("caches", {
      open: vi.fn().mockResolvedValue(mockCache),
    });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:mock-url"), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when the cache has no entry", async () => {
    mockCache.match.mockResolvedValue(undefined);
    const result = await getLogoFromLocalCache("Netflix");
    expect(result).toBeNull();
  });

  it("returns a blob URL when the cache has an entry", async () => {
    const fakeBlob = new Blob(["img"], { type: "image/png" });
    mockCache.match.mockResolvedValue({ blob: () => Promise.resolve(fakeBlob) });
    const result = await getLogoFromLocalCache("Netflix");
    expect(result).toBe("blob:mock-url");
  });

  it("returns null when caches is not available", async () => {
    vi.unstubAllGlobals();
    // Simulate environment without Cache Storage API
    const result = await getLogoFromLocalCache("Netflix");
    // In jsdom, caches is not defined so the function returns null
    expect(result).toBeNull();
  });

  it("saves a blob under the sanitized filename", async () => {
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue(mockCache) });
    mockCache.put.mockResolvedValue(undefined);
    const blob = new Blob(["img"], { type: "image/png" });
    await saveLogoToLocalCache("YouTube", blob);
    expect(mockCache.put).toHaveBeenCalledWith(
      "/youtube.png",
      expect.any(Response),
    );
  });
});

// ---------------------------------------------------------------------------
// getLogoFromSupabase
// ---------------------------------------------------------------------------

describe("getLogoFromSupabase", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the public URL when the HEAD request succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const result = await getLogoFromSupabase("youtube");
    expect(result).toBe(
      "https://example.supabase.co/storage/v1/object/public/merchant-logos/youtube.png",
    );
  });

  it("returns null when the HEAD request returns non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const result = await getLogoFromSupabase("unknown-brand");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const result = await getLogoFromSupabase("youtube");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// uploadLogoToSupabase
// ---------------------------------------------------------------------------

describe("uploadLogoToSupabase", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns null when fetching the image fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await uploadLogoToSupabase("netflix", "https://example.com/logo.png");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network")));
    const result = await uploadLogoToSupabase("netflix", "https://example.com/logo.png");
    expect(result).toBeNull();
  });

  it("returns the public URL on successful upload", async () => {
    vi.stubGlobal("caches", {
      open: vi.fn().mockResolvedValue({ put: vi.fn().mockResolvedValue(undefined) }),
    });
    const fakeBlob = new Blob(["img"], { type: "image/png" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(fakeBlob) }),
    );
    // mockUpdate handles the merchants table update inside uploadLogoToSupabase
    mockEq.mockResolvedValue({ error: null });
    const result = await uploadLogoToSupabase("youtube", "https://cdn.example.com/youtube.png");
    expect(result).toBe(
      "https://example.supabase.co/storage/v1/object/public/merchant-logos/youtube.png",
    );
  });
});

// ---------------------------------------------------------------------------
// saveMerchantLogoUrl
// ---------------------------------------------------------------------------

describe("saveMerchantLogoUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates lancamentos via merchant_id when provided", async () => {
    mockEq.mockResolvedValue({ error: null });
    mockIsNull.mockResolvedValue({ error: null });
    await saveMerchantLogoUrl("YouTube", "https://example.com/youtube.png", "merchant-uuid");
    // merchants.update should be called (for logo_url)
    expect(mockUpdate).toHaveBeenCalledWith({ logo_url: "https://example.com/youtube.png" });
  });

  it("falls back to updating lancamentos by loja name for legacy rows", async () => {
    mockEq.mockResolvedValue({ error: null });
    mockIsNull.mockResolvedValue({ error: null });
    await saveMerchantLogoUrl("YouTube", "https://example.com/youtube.png");
    // Legacy update: lancamentos.update({ merchant_logo_url }).eq("loja", "YouTube").is("merchant_id", null)
    expect(mockUpdateLegacy).toHaveBeenCalledWith({ merchant_logo_url: "https://example.com/youtube.png" });
  });
});

