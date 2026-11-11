import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

type Body = {
  listingId?: string;
  buyerId?: string;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { listingId, buyerId } = body;

  if (!listingId?.trim()) {
    return NextResponse.json({ error: "listingId is required" }, { status: 400 });
  }

  const supabase = adminClient();

  // 1 ── Fetch listing and validate status
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id, title, price_ngn, status, seller_id")
    .eq("id", listingId.trim())
    .maybeSingle();

  if (listingErr) {
    return NextResponse.json({ error: listingErr.message }, { status: 500 });
  }
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (listing.status === "Sold") {
    return NextResponse.json({ error: "This listing has already been sold." }, { status: 409 });
  }
  if (buyerId && listing.seller_id === buyerId) {
    return NextResponse.json({ error: "You cannot purchase your own listing." }, { status: 400 });
  }

  const priceNgn = Number(listing.price_ngn) || 0;
  if (priceNgn <= 0) {
    return NextResponse.json({ error: "Listing does not have a valid price." }, { status: 400 });
  }

  // 2 ── Generate server-side cryptographic reference (ECO-<listing>-<buyer>-<timestamp>-<nonce>)
  const listingPrefix = listing.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  const buyerPrefix = buyerId ? buyerId.replace(/-/g, "").slice(0, 6).toUpperCase() : "GUEST";
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(3).toString("hex").toUpperCase();
  const reference = `ECO-${listingPrefix}-${buyerPrefix}-${timestamp}-${nonce}`;

  const amountKobo = Math.round(priceNgn * 100);

  return NextResponse.json({
    ok: true,
    reference,
    listingId: listing.id,
    listingTitle: listing.title,
    amountNgn: priceNgn,
    amountKobo,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
  });
}

