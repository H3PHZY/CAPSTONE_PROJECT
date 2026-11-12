import type { MaterialCategory, TransactionStatus } from "@/lib/models";
import { djangoTransactions, type DjangoTransaction } from "@/lib/django-api";
import type { Txn } from "@/lib/types";

export type TransactionView = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  status: TransactionStatus;
  completedAt: string | null;
  paidAt: string | null;
  paymentRef: string | null;
  createdAt: string;
  listingTitle: string;
  material: MaterialCategory;
  weightKg: number;
  amountNgn: number | null;
  currency: string;
  counterpartyName: string;
  co2eKg: number | null;
};

export function mapTxn(row: DjangoTransaction): TransactionView {
  const amountNgn = row.amount_ngn == null ? null : Number(row.amount_ngn);
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    status: row.status as TransactionStatus,
    completedAt: row.completed_at,
    paidAt: row.paid_at,
    paymentRef: row.payment_ref,
    createdAt: row.created_at,
    listingTitle: row.listing_title || "Listing",
    material: (row.listing_material || "Metal") as MaterialCategory,
    weightKg: Number(row.listing_weight || 0),
    amountNgn,
    currency: row.currency || "NGN",
    counterpartyName: row.counterparty_name || "EcoLoop user",
    co2eKg: row.co2e_kg == null ? null : Number(row.co2e_kg),
  };
}

export async function findTransactionForPair(
  listingId: string,
  buyerId: string,
  sellerId: string
): Promise<DjangoTransaction | null> {
  const rows = await djangoTransactions.fetchMine();
  return (
    rows.find(
      (row) =>
        row.listing_id === listingId &&
        row.buyer_id === buyerId &&
        row.seller_id === sellerId
    ) ?? null
  );
}

export async function getPairTransactionView(
  listingId: string,
  buyerId: string,
  sellerId: string
) {
  const row = await findTransactionForPair(listingId, buyerId, sellerId);
  return row ? mapTxn(row) : null;
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
  if (input.actorId !== input.sellerId) {
    throw new Error("Only the seller can mark a deal as agreed");
  }

  const row = await djangoTransactions.markAgreed(input.listingId, input.buyerId);
  return mapTxn(row);
}

export async function markExchangeCompleted(input: {
  listingId: string;
  buyerId: string;
  sellerId: string;
  actorId: string;
}) {
  const row = await findTransactionForPair(
    input.listingId,
    input.buyerId,
    input.sellerId
  );
  if (!row || row.status === "Interest") {
    throw new Error("Reserve this buyer first, then mark the exchange completed");
  }
  if (row.status === "Completed") return mapTxn(row);
  if (row.status === "Cancelled") {
    throw new Error("This exchange was cancelled");
  }

  const price = Number(row.amount_ngn ?? 0);
  if (price > 0 && !row.paid_at) {
    throw new Error("Wait for payment to confirm before marking this exchange completed");
  }

  return mapTxn(
    await djangoTransactions.markCompleted(input.listingId, input.buyerId)
  );
}

export async function fetchMyTransactions() {
  const rows = await djangoTransactions.fetchMine();
  return rows.map(mapTxn);
}

export type CarbonImpactSummary = {
  totalCo2eKg: number;
  totalWeightKg: number;
  completedCount: number;
  byMaterial: [string, number][];
  byMonth: [string, number, number][];
  recent: Txn[];
};

export async function fetchCarbonImpact(): Promise<CarbonImpactSummary> {
  return djangoTransactions.fetchCarbonImpact();
}

export function transactionRef(id: string) {
  return `ECL-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function formatTransactionAmount(
  amount: number | null | undefined,
  currency: string
) {
  if (amount == null || !Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toLocaleString("en-NG")}`;
  }
}

export async function fetchTransactionById(id: string) {
  const rows = await djangoTransactions.fetchMine();
  const row = rows.find((transaction) => transaction.id === id);
  return row ? mapTxn(row) : null;
}
