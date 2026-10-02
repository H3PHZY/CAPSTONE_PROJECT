import { CO2, co2FromWeight } from "@/lib/carbon";
import type { MaterialCategory, TransactionStatus } from "@/lib/database.types";
import { formatPriceNgn } from "@/lib/listings";
import { supabase } from "@/lib/supabase";
import type { Txn } from "@/lib/types";

export type TransactionView = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  status: TransactionStatus;
  completedAt: string | null;
  createdAt: string;
  listingTitle: string;
  material: MaterialCategory;
  weightKg: number;
  priceNgn: number | null;
  counterpartyName: string;
  co2eKg: number | null;
};

type TxnJoin = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: TransactionStatus;
  completed_at: string | null;
  created_at: string;
  listing?: {
    id: string;
    title: string;
    material: MaterialCategory;
    weight_kg: number;
    price_ngn: number | null;
  } | null;
  buyer?: { business_name: string } | null;
  seller?: { business_name: string } | null;
  carbon_records?: { co2e_kg: number } | { co2e_kg: number }[] | null;
};

const TXN_SELECT = `
  *,
  listing:listings!listing_id (
    id,
    title,
    material,
    weight_kg,
    price_ngn
  ),
  buyer:profiles!buyer_id ( business_name ),
  seller:profiles!seller_id ( business_name ),
  carbon_records ( co2e_kg )
`;

function carbonOf(row: TxnJoin): number | null {
  const raw = row.carbon_records;
  if (!raw) return null;
  const rec = Array.isArray(raw) ? raw[0] : raw;
  return rec ? Number(rec.co2e_kg) : null;
}

function mapTxn(row: TxnJoin, viewerId: string): TransactionView {
  const isBuyer = row.buyer_id === viewerId;
  const counterparty = isBuyer ? row.seller : row.buyer;
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    listingTitle: row.listing?.title || "Listing",
    material: (row.listing?.material || "Metal") as MaterialCategory,
    weightKg: Number(row.listing?.weight_kg || 0),
    priceNgn: row.listing?.price_ngn ?? null,
    counterpartyName: counterparty?.business_name || "EcoLoop user",
    co2eKg: carbonOf(row),
  };
}

export async function findTransactionForPair(
  listingId: string,
  buyerId: string,
  sellerId: string
) {
  const { data, error } = await supabase
    .from("transactions")
    .select(TXN_SELECT)
    .eq("listing_id", listingId)
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (error) throw error;
  return data as TxnJoin | null;
}

export async function getPairTransactionView(
  listingId: string,
  buyerId: string,
  sellerId: string,
  viewerId: string
) {
  const row = await findTransactionForPair(listingId, buyerId, sellerId);
  return row ? mapTxn(row, viewerId) : null;
}

export async function markAsAgreed(input: {
  listingId: string;
  buyerId: string;
  sellerId: string;
  actorId: string;
}) {
  if (input.buyerId === input.sellerId) {
    throw new Error("Buyer and seller must be different users");
  }
  // Only the seller reserves the lot — they choose which buyer gets it.
  if (input.actorId !== input.sellerId) {
    throw new Error("Only the seller can mark a deal as agreed");
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, status, seller_id")
    .eq("id", input.listingId)
    .maybeSingle();
  if (listingError) throw listingError;
  if (!listing || listing.seller_id !== input.sellerId) {
    throw new Error("Listing not found");
  }
  if (listing.status === "Sold") {
    throw new Error("This listing is already sold");
  }

  // Another buyer already holds this lot
  const { data: otherHold, error: holdError } = await supabase
    .from("transactions")
    .select("id, buyer_id, status")
    .eq("listing_id", input.listingId)
    .in("status", ["Reserved", "Completed"])
    .neq("buyer_id", input.buyerId)
    .limit(1)
    .maybeSingle();
  if (holdError) throw holdError;
  if (otherHold) {
    throw new Error(
      "This listing is already reserved for another buyer. Complete or cancel that deal first."
    );
  }

  let row = await findTransactionForPair(
    input.listingId,
    input.buyerId,
    input.sellerId
  );

  if (!row) {
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        listing_id: input.listingId,
        buyer_id: input.buyerId,
        seller_id: input.sellerId,
        status: "Reserved",
      })
      .select(TXN_SELECT)
      .single();
    if (error) throw error;
    return mapTxn(data as TxnJoin, input.actorId);
  }

  if (row.status === "Completed") {
    throw new Error("This exchange is already completed");
  }
  if (row.status === "Cancelled") {
    throw new Error("This exchange was cancelled");
  }

  if (row.status !== "Reserved") {
    const { data, error } = await supabase
      .from("transactions")
      .update({ status: "Reserved" })
      .eq("id", row.id)
      .select(TXN_SELECT)
      .single();
    if (error) throw error;
    row = data as TxnJoin;
  }

  // Listing status synced by DB trigger (002_transaction_listing_sync.sql)
  return mapTxn(row, input.actorId);
}

export async function markExchangeCompleted(input: {
  listingId: string;
  buyerId: string;
  sellerId: string;
  actorId: string;
}) {
  let row = await findTransactionForPair(
    input.listingId,
    input.buyerId,
    input.sellerId
  );

  if (!row || row.status === "Interest") {
    throw new Error("Reserve this buyer first, then mark the exchange completed");
  }

  if (!row) throw new Error("Could not create transaction");
  if (row.status === "Completed") return mapTxn(row, input.actorId);
  if (row.status === "Cancelled") {
    throw new Error("This exchange was cancelled");
  }

  const material = (row.listing?.material || "Metal") as MaterialCategory;
  const weightKg = Number(row.listing?.weight_kg || 0);
  if (weightKg <= 0) throw new Error("Listing weight is missing");

  const factor = CO2[material] ?? 1;
  const co2eKg = co2FromWeight(weightKg, material);

  const { error } = await supabase
    .from("transactions")
    .update({
      status: "Completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (error) throw error;

  const { error: carbonError } = await supabase.from("carbon_records").upsert(
    {
      transaction_id: row.id,
      material,
      weight_kg: weightKg,
      co2e_kg: co2eKg,
      factor_kg_per_kg: factor,
      notes: "LCA estimate vs virgin material (EcoLoop pilot)",
    },
    { onConflict: "transaction_id" }
  );

  if (carbonError) throw carbonError;

  const refreshed = await findTransactionForPair(
    input.listingId,
    input.buyerId,
    input.sellerId
  );
  if (!refreshed) throw new Error("Transaction updated but could not reload");
  return mapTxn(refreshed, input.actorId);
}

export async function fetchMyTransactions(userId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select(TXN_SELECT)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as TxnJoin[]).map((row) => mapTxn(row, userId));
}

export type CarbonImpactSummary = {
  totalCo2eKg: number;
  totalWeightKg: number;
  completedCount: number;
  byMaterial: [string, number][];
  byMonth: [string, number, number][];
  recent: Txn[];
};

export async function fetchCarbonImpact(userId: string): Promise<CarbonImpactSummary> {
  const txns = await fetchMyTransactions(userId);
  const completed = txns.filter((t) => t.status === "Completed");

  const totalCo2eKg = completed.reduce((sum, t) => sum + (t.co2eKg ?? 0), 0);
  const totalWeightKg = completed.reduce((sum, t) => sum + t.weightKg, 0);

  const materialMap = new Map<string, number>();
  const monthMap = new Map<string, number>();

  for (const t of completed) {
    materialMap.set(t.material, (materialMap.get(t.material) || 0) + (t.co2eKg ?? 0));
    const when = t.completedAt || t.createdAt;
    const label = new Date(when).toLocaleDateString("en-GB", { month: "short" });
    monthMap.set(label, (monthMap.get(label) || 0) + (t.co2eKg ?? 0));
  }

  const byMaterial = [...materialMap.entries()].sort((a, b) => b[1] - a[1]) as [
    string,
    number,
  ][];

  const byMonth = [...monthMap.entries()].map(([month, val]) => {
    const target = Math.max(val, 500);
    return [month, val, target] as [string, number, number];
  });

  const recent: Txn[] = completed.slice(0, 12).map((t) => ({
    material: t.material,
    party: t.counterpartyName,
    weight: t.weightKg,
    value: formatPriceNgn(t.priceNgn),
    co2: t.co2eKg ?? 0,
    date: new Date(t.completedAt || t.createdAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    }),
  }));

  return {
    totalCo2eKg,
    totalWeightKg,
    completedCount: completed.length,
    byMaterial,
    byMonth,
    recent,
  };
}
