import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ─── Types ──────────────────────────────────────────────────────────────────

type Body = {
  reference?: string;
  listingId?: string;
  buyerId?: string;
  /** Expected price in Naira (integer) as stored in Supabase */
  expectedNgn?: number;
};

type PaystackData = {
  status: string;
  amount: number; // kobo
  reference: string;
  customer?: { email?: string };
};

type PaystackResponse = {
  status: boolean;
  message: string;
  data: PaystackData;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build an admin Supabase client that bypasses RLS (service role). */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1 ── Parse + validate body
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { reference, listingId, buyerId, expectedNgn } = body;

  if (!reference?.trim()) {
    return NextResponse.json(
      { error: "reference is required" },
      { status: 400 }
    );
  }
  if (!listingId?.trim()) {
    return NextResponse.json(
      { error: "listingId is required" },
      { status: 400 }
    );
  }
  if (!buyerId?.trim()) {
    return NextResponse.json(
      { error: "buyerId is required" },
      { status: 400 }
    );
  }
  if (typeof expectedNgn !== "number" || expectedNgn <= 0) {
    return NextResponse.json(
      { error: "expectedNgn must be a positive number" },
      { status: 400 }
    );
  }

  // 2 ── Check secret key present
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "PAYSTACK_SECRET_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  // 3 ── Verify with Paystack
  let paystackData: PaystackData;
  try {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference.trim())}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const json = (await res.json()) as PaystackResponse;

    if (!res.ok || !json.status) {
      return NextResponse.json(
        { error: json.message || `Paystack verification failed (${res.status})` },
        { status: 502 }
      );
    }

    paystackData = json.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error reaching Paystack";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // 4 ── Confirm payment status
  if (paystackData.status !== "success") {
    return NextResponse.json(
      {
        error: `Payment not successful. Paystack status: "${paystackData.status}". No charge has been made.`,
        code: "PAYMENT_NOT_SUCCESS",
      },
      { status: 402 }
    );
  }

  // 5 ── Fetch listing directly from DB to obtain ground truth price
  const supabase = adminClient();

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id, seller_id, status, price_ngn")
    .eq("id", listingId.trim())
    .maybeSingle();

  if (listingErr) {
    return NextResponse.json({ error: listingErr.message }, { status: 500 });
  }
  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }
  if (listing.status === "Sold") {
    return NextResponse.json(
      { error: "This listing has already been sold." },
      { status: 409 }
    );
  }
  if (listing.status !== "Live" && listing.status !== "Reserved") {
    return NextResponse.json(
      { error: `Listing is not available for purchase (status: ${listing.status}).` },
      { status: 409 }
    );
  }
  if (listing.seller_id === buyerId) {
    return NextResponse.json(
      { error: "You cannot purchase your own listing." },
      { status: 400 }
    );
  }

  // 6 ── Amount guard: strictly check Paystack amount against database ground truth
  const dbPriceNgn = Number(listing.price_ngn) || 0;
  const expectedKobo = Math.round(dbPriceNgn * 100);
  if (paystackData.amount < expectedKobo) {
    return NextResponse.json(
      {
        error: `Payment amount mismatch. Expected ₦${dbPriceNgn.toLocaleString("en-NG")} based on database records, but Paystack confirmed ₦${(paystackData.amount / 100).toLocaleString("en-NG")}.`,
        code: "AMOUNT_MISMATCH",
        expectedKobo,
        receivedKobo: paystackData.amount,
      },
      { status: 422 }
    );
  }

  // 7 ── Upsert transaction row → Completed, then mark listing → Sold
  const now = new Date().toISOString();

  const { error: txErr } = await supabase.from("transactions").upsert(
    {
      listing_id: listingId.trim(),
      buyer_id: buyerId.trim(),
      seller_id: listing.seller_id as string,
      status: "Completed",
      completed_at: now,
    },
    { onConflict: "listing_id,buyer_id,seller_id" }
  );

  if (txErr) {
    return NextResponse.json({ error: txErr.message }, { status: 500 });
  }

  const { error: updateErr } = await supabase
    .from("listings")
    .update({ status: "Sold" })
    .eq("id", listingId.trim());

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 8 ── Success
  return NextResponse.json({
    ok: true,
    reference: paystackData.reference,
    amountNgn: paystackData.amount / 100,
    listingId: listingId.trim(),
    message: "Payment verified and listing marked as Sold.",
  });
}
