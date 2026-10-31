import { createClient } from "@supabase/supabase-js";

const env = process.env;
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data, error: loginError } = await supabase.auth.signInWithPassword({
  email: env.TEST_SELLER_EMAIL,
  password: env.TEST_SELLER_PASSWORD,
});
if (loginError) throw loginError;
const sellerId = data.user.id;

const reserve = (buyerId) =>
  supabase.rpc("reserve_listing_for_buyer", {
    p_listing_id: env.TEST_LISTING_ID,
    p_buyer_id: buyerId,
    p_seller_id: sellerId,
  });

const [a, b] = await Promise.all([reserve(env.TEST_BUYER_A_ID), reserve(env.TEST_BUYER_B_ID)]);
console.log("Buyer A:", a.error ? `REJECTED: ${a.error.message}` : "RESERVED");
console.log("Buyer B:", b.error ? `REJECTED: ${b.error.message}` : "RESERVED");

const winners = [a, b].filter((r) => !r.error).length;
console.log(winners === 1 ? "PASS: exactly one buyer reserved the lot" : `FAIL: ${winners} buyers reserved the lot`);
process.exit(winners === 1 ? 0 : 1);