import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Listing = { price_ngn: number | null };
type DealRow = {
  id: string;
  buyer_id: string;
  status: string;
  paid_at: string | null;
  listing: Listing | Listing[] | null;
};

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!supabaseUrl || !serviceKey || !paystackSecret) {
    return fail("Payments are not configured on the server", 503);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  // 1. Who is calling?
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return fail("Please log in again", 401);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return fail("Please log in again", 401);

  // 2. Read the request
  let body: { reference?: string; transactionId?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request", 400);
  }
  const reference = body.reference?.trim();
  const transactionId = body.transactionId?.trim();
  if (!reference || !transactionId || !reference.startsWith(`eco-${transactionId}-`)) {
    return fail("Reference does not match this deal", 400);
  }

  // 3. Load the deal and the price from our own database
  const { data, error } = await admin
    .from("transactions")
    .select("id, buyer_id, status, paid_at, listing:listings ( price_ngn )")
    .eq("id", transactionId)
    .maybeSingle();
  const deal = data as DealRow | null;
  if (error || !deal) return fail("Deal not found", 404);
  if (deal.buyer_id !== auth.user.id) return fail("Only the buyer can pay", 403);
  if (deal.status !== "Reserved") return fail("This deal is not reserved", 409);
  if (deal.paid_at) return fail("This deal is already paid", 409);

  const listing = Array.isArray(deal.listing) ? deal.listing[0] : deal.listing;
  const priceNgn = Number(listing?.price_ngn ?? 0);
  if (!(priceNgn > 0)) return fail("This listing has no price", 400);

  // 4. Ask Paystack if the payment really happened
  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${paystackSecret}` }, cache: "no-store" }
  );
  const json = await res.json().catch(() => null);
  const paid = json?.data;
  if (!res.ok || !paid || paid.status !== "success") {
    return fail("Paystack did not confirm this payment", 400);
  }
  if (
    paid.reference !== reference ||
    paid.currency !== "NGN" ||
    paid.amount !== Math.round(priceNgn * 100)
  ) {
    return fail("Payment amount does not match the listing price", 400);
  }

  // 5. Save it
  const { data: updated, error: updateError } = await admin
    .from("transactions")
    .update({ payment_ref: reference, paid_at: new Date().toISOString() })
    .eq("id", transactionId)
    .is("paid_at", null)
    .select("id");
  if (updateError) {
    if (updateError.code === "23505") return fail("This payment was already used", 409);
    return fail("Could not save the payment", 500);
  }
  if (!updated?.length) return fail("This deal is already paid", 409);

  return NextResponse.json({ ok: true });
}