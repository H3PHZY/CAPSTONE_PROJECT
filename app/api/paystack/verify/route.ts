import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  effectivePaymentPriceNgn,
  paymentAmountKobo,
} from "@/lib/payment-pricing";

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
  pending_payment_ref: string | null;
  pending_payment_expires_at: string | null;
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
  if (!reference || !transactionId) return fail("Missing payment reference", 400);

  const { data, error } = await admin
    .from("transactions")
    .select(
      "id, listing_id, buyer_id, seller_id, status, paid_at, deal_price_ngn, pending_payment_ref, pending_payment_expires_at, listing:listings ( price_ngn )"
    )
    .eq("id", transactionId)
    .maybeSingle();

  const deal = data as DealRow | null;
  if (error) {
    console.error("paystack verify: transaction lookup failed", error.message);
    if (
      error.message.includes("pending_payment_ref") ||
      error.message.includes("pending_payment_expires_at") ||
      error.message.includes("deal_price_ngn")
    ) {
      const migration = error.message.includes("deal_price_ngn")
        ? "015_deal_price.sql and 016_atomic_reservations_and_payments.sql"
        : "016_atomic_reservations_and_payments.sql";
      return fail(
        `Run supabase/migrations/${migration} in the SQL Editor, in order, then try again.`,
        503
      );
    }
    return fail("Could not load this deal", 500);
  }
  if (!deal) return fail("Deal not found", 404);
  if (deal.buyer_id !== auth.user.id) return fail("Only the buyer can pay", 403);
  if (deal.status !== "Reserved") return fail("This deal is not reserved", 409);
  if (deal.paid_at) return fail("This deal is already paid", 409);
  if (deal.pending_payment_ref !== reference) {
    return fail("Payment reference was not issued for this deal", 400);
  }
  if (
    !deal.pending_payment_expires_at ||
    Date.parse(deal.pending_payment_expires_at) <= Date.now()
  ) {
    return fail("This payment reference has expired. Start payment again.", 409);
  }

  const listing = Array.isArray(deal.listing) ? deal.listing[0] : deal.listing;
  const priceNgn = effectivePaymentPriceNgn(
    deal.deal_price_ngn,
    listing?.price_ngn ?? null
  );
  if (priceNgn == null) return fail("No price has been set for this exchange", 400);

  const expectedKobo = paymentAmountKobo(priceNgn);
  if (expectedKobo == null) return fail("The agreed price is outside the payment limit", 400);

  let res: Response;
  try {
    res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${paystackSecret}` },
        cache: "no-store",
      }
    );
  } catch (err) {
    console.error(
      "paystack verify: provider request failed",
      err instanceof Error ? err.message : "Unknown network error"
    );
    return fail("Could not reach Paystack to verify this payment. Please try again.", 502);
  }
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
  if (paid.reference !== reference || currency !== "NGN" || paidKobo !== expectedKobo) {
    return fail("Payment amount does not match the agreed price", 400);
  }

  const { error: confirmError } = await admin.rpc("confirm_paystack_payment", {
    p_transaction_id: transactionId,
    p_buyer_id: auth.user.id,
    p_reference: reference,
    p_amount_kobo: paidKobo,
  });

  if (confirmError) {
    if (confirmError.message.includes("already paid")) {
      return fail("This deal is already paid", 409);
    }
    if (
      confirmError.message.includes("reference") ||
      confirmError.message.includes("reserved")
    ) {
      return fail(confirmError.message, 409);
    }
    if (confirmError.message.includes("amount")) {
      return fail(confirmError.message, 400);
    }
    if (confirmError.message.includes("confirm_paystack_payment")) {
      return fail(
        "Run supabase/migrations/016_atomic_reservations_and_payments.sql in the SQL Editor, then try again.",
        503
      );
    }
    console.error("paystack verify: payment confirmation failed", confirmError.message);
    return fail("Could not save the payment", 500);
  }

  const amountLabel = Math.round(priceNgn).toLocaleString("en-NG");
  const { error: messageError } = await admin.from("messages").insert({
    listing_id: deal.listing_id,
    sender_id: deal.buyer_id,
    recipient_id: deal.seller_id,
    body: `Paystack confirmed · ₦${amountLabel}`,
  });
  if (messageError) {
    console.error("paystack verify: message insert failed", messageError.message);
  }

  return NextResponse.json({ ok: true, reference });
}
