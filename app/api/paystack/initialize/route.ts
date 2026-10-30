import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export async function POST(request: Request) {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return fail("Payments are not configured on the server", 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail("Please log in again", 401);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return fail("Please log in again", 401);

  let body: { transactionId?: string };
  try {
    body = (await request.json()) as { transactionId?: string };
  } catch {
    return fail("Invalid request", 400);
  }

  const transactionId = body.transactionId?.trim();
  if (!transactionId) return fail("Missing transaction", 400);

  const { data: transaction, error: transactionError } = await admin
    .from("transactions")
    .select("id, listing_id")
    .eq("id", transactionId)
    .eq("buyer_id", auth.user.id)
    .maybeSingle();
  if (transactionError) {
    console.error("paystack initialize: transaction lookup failed", transactionError.message);
    return fail("Could not load this deal", 500);
  }
  if (!transaction) return fail("Deal not found", 404);

  const timestamp = Date.now();
  const nonce = randomBytes(8).toString("hex").toUpperCase();
  const listingRef = transaction.listing_id.replace(/-/g, "").slice(0, 8).toUpperCase();
  const candidateReference = `ECO-${listingRef}-${timestamp}-${nonce}`;
  const expiresAt = new Date(timestamp + 30 * 60 * 1000).toISOString();
  const { data, error } = await admin.rpc("issue_payment_reference", {
    p_transaction_id: transaction.id,
    p_buyer_id: auth.user.id,
    p_reference: candidateReference,
    p_expires_at: expiresAt,
  });

  if (error) {
    console.error("paystack initialize: could not issue payment reference", error.message);
    if (error.message.includes("issue_payment_reference")) {
      return fail(
        "Run supabase/migrations/016_atomic_reservations_and_payments.sql in the SQL Editor, then try again.",
        503
      );
    }
    if (error.message.includes("reserved") || error.message.includes("already paid")) {
      return fail(error.message, 409);
    }
    if (error.message.includes("another buyer")) return fail(error.message, 409);
    if (error.message.includes("price")) return fail(error.message, 400);
    return fail("Could not prepare payment", 500);
  }

  const payment = Array.isArray(data) ? data[0] : data;
  const amountKobo = Number(payment?.amount_kobo);
  if (
    !payment?.payment_reference ||
    !Number.isSafeInteger(amountKobo) ||
    amountKobo <= 0
  ) {
    console.error("paystack initialize: database returned invalid payment details");
    return fail("Could not prepare payment", 500);
  }

  return NextResponse.json({
    reference: payment.payment_reference,
    amountKobo,
  });
}
