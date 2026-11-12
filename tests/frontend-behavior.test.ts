import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, getApiBaseUrl, handleError } from "@/lib/django-auth";
import { djangoDisputes, djangoListings, type DjangoListing } from "@/lib/django-api";
import { getPublishLocation } from "@/lib/listing-location";
import { canManuallyCompleteTransaction } from "@/lib/transaction-ui";
import { formatTransactionAmount, mapTxn } from "@/lib/transactions";
import type { DjangoTransaction } from "@/lib/django-api";
import { canRaiseDispute } from "@/lib/disputes";
import { createLiveListing, publishOwnedListing } from "@/lib/listings";

describe("transaction completion controls", () => {
  it("does not allow manual completion while payment is outstanding", () => {
    expect(canManuallyCompleteTransaction("Reserved", 52000, null)).toBe(false);
  });

  describe("dispute eligibility", () => {
    const transaction = {
      id: "txn-1",
      buyerId: "buyer-1",
      paidAt: "2026-11-12T00:00:00Z",
    };

    it("only allows the buyer to dispute a paid transaction without an open dispute", () => {
      expect(canRaiseDispute(transaction, "buyer-1", [])).toBe(true);
      expect(canRaiseDispute(transaction, "seller-1", [])).toBe(false);
      expect(canRaiseDispute({ ...transaction, paidAt: null }, "buyer-1", [])).toBe(false);
      expect(
        canRaiseDispute(transaction, "buyer-1", [
          {
            id: "dispute-1",
            transaction_id: "txn-1",
            raised_by_id: "buyer-1",
            reason: "Issue",
            status: "Open",
            resolution_note: "",
            created_at: "2026-11-12T00:00:00Z",
            updated_at: "2026-11-12T00:00:00Z",
          },
        ])
      ).toBe(false);
    });
  });

  it("allows manual completion only after a reserved deal has been paid", () => {
    expect(canManuallyCompleteTransaction("Reserved", 52000, "2026-11-12T00:00:00Z")).toBe(true);
    expect(canManuallyCompleteTransaction("Reserved", null, null)).toBe(false);
    expect(canManuallyCompleteTransaction("Completed", null, null)).toBe(false);
  });

  it("uses the transaction amount and currency snapshot", () => {
    const transaction = mapTxn({
      id: "txn-1",
      listing_id: "listing-1",
      listing_title: "Metal offcuts",
      listing_material: "Metal",
      listing_weight: "25",
      amount_ngn: "12500.00",
      currency: "NGN",
      buyer_id: "buyer-1",
      seller_id: "seller-1",
      counterparty_name: "Seller",
      counterparty_id: "seller-1",
      status: "Reserved",
      payment_ref: null,
      paid_at: null,
      completed_at: null,
      co2e_kg: null,
      created_at: "2026-11-12T00:00:00Z",
    } satisfies DjangoTransaction);

    expect(transaction.amountNgn).toBe(12500);
    expect(transaction.currency).toBe("NGN");
    expect(formatTransactionAmount(transaction.amountNgn, transaction.currency)).toContain("12,500");
  });
});

describe("production API configuration", () => {
  it("requires the Django API URL in production", () => {
    expect(() => getApiBaseUrl(undefined, "production")).toThrow(
      "NEXT_PUBLIC_DJANGO_API_URL must be set for production builds."
    );
    expect(getApiBaseUrl(undefined, "development")).toBe(
      "http://127.0.0.1:8000/api"
    );
  });
});

describe("API error handling", () => {
  it("uses the exact message returned by Django", async () => {
    const response = new Response(
      JSON.stringify({ error: "Payment amount mismatch." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );

    await expect(handleError(response)).rejects.toMatchObject({
      name: "DjangoApiError",
      message: "Payment amount mismatch.",
      status: 400,
    });
  });

  it("shows a friendly message when Django is waking up", async () => {
    const response = new Response(JSON.stringify({ detail: "Unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });

    await expect(handleError(response)).rejects.toMatchObject({
      message:
        "EcoLoop is temporarily unavailable. The service may be waking up; please try again shortly.",
      status: 503,
    });
  });
});

describe("listing publication location", () => {
  it("uses zone coordinates and omits unresolved address when geocoding failed", () => {
    expect(
      getPublishLocation(
        { address: "Unresolved street", lat: null, lng: null },
        "Isolo"
      )
    ).toEqual({
      address: "",
      lat: 6.535,
      lng: 3.322,
      usedZoneDefault: true,
    });
  });

  it("preserves a successfully geocoded pickup location", () => {
    expect(
      getPublishLocation(
        { address: "  Verified address  ", lat: 6.6, lng: 3.3 },
        "Isolo"
      )
    ).toEqual({
      address: "Verified address",
      lat: 6.6,
      lng: 3.3,
      usedZoneDefault: false,
    });
  });
});

describe("backend wake-up retry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retries a failed GET once and returns the successful response", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/health/")).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not replay a failed mutation request", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiFetch("/transactions/mark_completed/", { method: "POST" })
    ).rejects.toThrow("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("creates a draft with is_draft enabled and publishes drafts with POST", async () => {
    const createSpy = vi
      .spyOn(djangoListings, "create")
      .mockResolvedValue({ id: "draft-1" } as DjangoListing);
    vi.spyOn(djangoListings, "fetchById").mockRejectedValue(new Error("stop after create"));

    await expect(
      createLiveListing({
        sellerId: "seller-1",
        title: "Metal offcuts",
        material: "Metal",
        weightKg: 20,
        priceNgn: 5000,
        photoUrl: "https://example.test/photo.jpg",
        zone: "Isolo",
        predictedMaterial: "Metal",
        confidence: 0.9,
        overridden: false,
        isDraft: true,
      })
    ).rejects.toThrow("stop after create");
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ is_draft: true }));

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "draft-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await publishOwnedListing("draft-1");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/listings/draft-1/publish/"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("creates a dispute using the transaction_id/reason endpoint fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "dispute-1" }), { status: 201 })
      );
    vi.stubGlobal("fetch", fetchMock);

    await djangoDisputes.create({ transaction_id: "txn-1", reason: "Material not received" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/disputes/"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ transaction_id: "txn-1", reason: "Material not received" }),
      })
    );
  });
});
