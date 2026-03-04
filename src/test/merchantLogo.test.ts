import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sanitizeStoreName,
  getLogoFromLocalCache,
  saveLogoToLocalCache,
  getLogoFromSupabase,
  uploadLogoToSupabase,
  saveMerchantLogoUrl,
  backfillMerchantLogos,
} from "@/lib/merchantLogo";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/brandfetch", () => ({
  searchBrandfetchDomain: vi.fn(async () => null),
}));

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
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    })),
  },
}));

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
  it("calls supabase update with the correct parameters", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    vi.mocked(supabase.from).mockReturnValue({ update: updateMock } as never);

    await saveMerchantLogoUrl("YouTube", "https://example.com/youtube.png");

    expect(supabase.from).toHaveBeenCalledWith("lancamentos");
    expect(updateMock).toHaveBeenCalledWith({ merchant_logo_url: "https://example.com/youtube.png" });
    expect(eqMock).toHaveBeenCalledWith("loja", "YouTube");
  });
});

// ---------------------------------------------------------------------------
// backfillMerchantLogos
// ---------------------------------------------------------------------------

describe("backfillMerchantLogos", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns zeros when there are no lancamentos without logos", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    // Query returns empty list
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    } as never);

    const result = await backfillMerchantLogos("user-1");
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
  });

  it("returns zeros when the query fails", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
            }),
          }),
        }),
      }),
    } as never);

    const result = await backfillMerchantLogos("user-1");
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
  });

  it("resolves via Supabase Storage when logo already exists there", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const eqUpdateMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: eqUpdateMock }));

    vi.mocked(supabase.from)
      .mockReturnValueOnce({
        // First call: SELECT lancamentos
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ data: [{ loja: "Netflix" }], error: null }),
              }),
            }),
          }),
        }),
      } as never)
      .mockReturnValueOnce({ update: updateMock } as never); // Second call: UPDATE

    // Supabase Storage HEAD request succeeds → logo exists
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const result = await backfillMerchantLogos("user-1");
    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(updateMock).toHaveBeenCalledWith({
      merchant_logo_url: expect.stringContaining("merchant-logos"),
    });
  });

  it("falls back to external API and uploads when not in Supabase Storage", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const eqUpdateMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: eqUpdateMock }));

    vi.mocked(supabase.from)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ data: [{ loja: "Netflix" }], error: null }),
              }),
            }),
          }),
        }),
      } as never)
      .mockReturnValueOnce({ update: updateMock } as never);

    const fakeBlob = new Blob(["img"], { type: "image/png" });
    // First fetch: HEAD for Supabase Storage → 404 (not found)
    // Second fetch: GET external URL → ok, returns blob
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: true, blob: () => Promise.resolve(fakeBlob) }),
    );
    vi.stubGlobal("caches", {
      open: vi.fn().mockResolvedValue({ put: vi.fn().mockResolvedValue(undefined) }),
    });

    const result = await backfillMerchantLogos("user-1");
    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
  });

  it("counts as failed when upload returns null", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const uploadFromMock = vi.fn(() => ({
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/logo.png" } })),
      upload: vi.fn(() => ({ error: { message: "upload fail" } })),
    }));

    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: [{ loja: "Unknown" }], error: null }),
            }),
          }),
        }),
      }),
    } as never);

    vi.mocked(supabase.storage.from).mockReturnValue(uploadFromMock() as never);

    const fakeBlob = new Blob(["img"], { type: "image/png" });
    // HEAD → 404, external GET → ok but Supabase upload fails
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: true, blob: () => Promise.resolve(fakeBlob) }),
    );
    vi.stubGlobal("caches", {
      open: vi.fn().mockResolvedValue({ put: vi.fn().mockResolvedValue(undefined) }),
    });

    const result = await backfillMerchantLogos("user-1");
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);
  });

  it("deduplicates store names before processing", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const eqUpdateMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: eqUpdateMock }));

    vi.mocked(supabase.from)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  // Three rows but only two unique stores
                  data: [{ loja: "Netflix" }, { loja: "Netflix" }, { loja: "Spotify" }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as never)
      .mockReturnValue({ update: updateMock } as never);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const progressCalls: number[] = [];
    const result = await backfillMerchantLogos("user-1", (done) => progressCalls.push(done));

    // Should process 2 unique stores, not 3
    expect(result.processed).toBe(2);
  });

  it("calls onProgress with correct done/total values", async () => {
    const { supabase } = await import("@/integrations/supabase/client");

    vi.mocked(supabase.from)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ loja: "Netflix" }, { loja: "Spotify" }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as never)
      .mockReturnValue({ update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) } as never);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const calls: Array<[number, number]> = [];
    await backfillMerchantLogos("user-1", (done, total) => calls.push([done, total]));

    // First call: done=0, total=2; second: done=1, total=2; final: done=2, total=2
    expect(calls[0]).toEqual([0, 2]);
    expect(calls[calls.length - 1]).toEqual([2, 2]);
  });
});
