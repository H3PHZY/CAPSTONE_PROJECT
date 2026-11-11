import type { MaterialCategory, TransactionStatus } from "@/lib/database.types";
import { djangoTransactions, type DjangoTransaction } from "@/lib/django-api";
import { formatPriceNgn } from "@/lib/listings";
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
  priceNgn: number | null;
  listingPriceNgn: number | null;
  dealPriceNgn: number | null;
  counterpartyName: string;
  co2eKg: number | null;
};

function mapTxn(row: DjangoTransaction): TransactionView {
  const listingPrice = row.listing_price == null ? null : Number(row.listing_price);
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
    priceNgn: listingPrice,
    listingPriceNgn: listingPrice,
    dealPriceNgn: null,
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
  sellerId: string,
  _viewerId: string
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

  const price = Number(row.listing_price ?? 0);
  if (price > 0 && !row.paid_at) {
    throw new Error("Wait for payment to confirm before marking this exchange completed");
  }

  return mapTxn(
    await djangoTransactions.markCompleted(input.listingId, input.buyerId)
  );
}

export async function fetchMyTransactions(_userId: string) {
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

export async function fetchCarbonImpact(
  _userId: string
): Promise<CarbonImpactSummary> {
  return djangoTransactions.fetchCarbonImpact();
}

export function transactionRef(id: string) {
  return `ECL-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function fetchTransactionById(id: string, _viewerId: string) {
  const rows = await djangoTransactions.fetchMine();
  const row = rows.find((transaction) => transaction.id === id);
  return row ? mapTxn(row) : null;
}
