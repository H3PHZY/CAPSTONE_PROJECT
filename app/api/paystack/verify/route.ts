import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Listing = { price_ngn: number | null };
type DealRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  paid_at: string | null;
  deal_price_ngn: number | null;
  listing: Listing | Listing[] | null;
};

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export async function POST(request: Request) {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const paystackSecret = env("PAYSTACK_SECRET_KEY");
  if (!supabaseUrl || !serviceKey || !paystackSecret) {
    return fail("Payments are not configured on the server", 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail("Please log in again", 401);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return fail("Please log in again", 401);

  let body: { reference?: string; transactionId?: string };
  try {
    body = (await request.json()) as { reference?: string; transactionId?: string };
  } catch {
    return fail("Invalid request", 400);
  }

  const reference = body.reference?.trim();
  const transactionId = body.transactionId?.trim();
  if (!reference || !transactionId) {
    return fail("Missing payment reference", 400);
  }
  if (!reference.includes(transactionId)) {
    return fail("Reference does not match this deal", 400);
  }

  const { data, error } = await admin
    .from("transactions")
    .select(
      "id, listing_id, buyer_id, seller_id, status, paid_at, deal_price_ngn, listing:listings ( price_ngn )"
    )
    .eq("id", transactionId)
    .maybeSingle();

  const deal = data as DealRow | null;
  if (error || !deal) {
    return fail(
      error?.message?.includes("deal_price_ngn")
        ? "Run supabase/migrations/015_deal_price.sql in the SQL Editor, then try again."
        : "Deal not found",
      error?.message?.includes("deal_price_ngn") ? 503 : 404
    );
  }
  if (deal.buyer_id !== auth.user.id) return fail("Only the buyer can pay", 403);
  if (deal.status !== "Reserved") return fail("This deal is not reserved", 409);
  if (deal.paid_at) return fail("This deal is already paid", 409);

  const listing = Array.isArray(deal.listing) ? deal.listing[0] : deal.listing;
  const priceNgn = Number(deal.deal_price_ngn ?? listing?.price_ngn ?? 0);
  if (!(priceNgn > 0)) return fail("No price has been set for this exchange", 400);

  const expectedKobo = Math.round(priceNgn * 100);
  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${paystackSecret}` }, cache: "no-store" }
  );
  const json = (await res.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: {
      status?: string;
      reference?: string;
      currency?: string;
      amount?: number;
    };
  } | null;
  const paid = json?.data;
  if (!res.ok || !json?.status || !paid || paid.status !== "success") {
    const detail = json?.message?.trim();
    return fail(
      detail && detail !== "An error occurred"
        ? `Paystack could not confirm this payment (${detail})`
        : "Paystack could not confirm this payment. Check PAYSTACK_SECRET_KEY and restart the app.",
      400
    );
  }

  const paidKobo = Number(paid.amount);
  const currency = (paid.currency || "").toUpperCase();
  if (currency !== "NGN" || paidKobo !== expectedKobo) {
    return fail("Payment amount does not match the agreed price", 400);
  }

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

  const amountLabel = Math.round(priceNgn).toLocaleString("en-NG");
  const { error: messageError } = await admin.from("messages").insert({
    listing_id: deal.listing_id,
    sender_id: deal.buyer_id,
    recipient_id: deal.seller_id,
    body: `Payment received · ₦${amountLabel}`,
  });
  if (messageError) {
    console.error("paystack verify: message insert failed", messageError.message);
  }

  return NextResponse.json({ ok: true, reference });
}