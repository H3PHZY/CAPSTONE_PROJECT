import type { DjangoDispute } from "@/lib/django-api";
import type { TransactionView } from "@/lib/transactions";

export function canRaiseDispute(
  transaction: Pick<TransactionView, "buyerId" | "paidAt" | "id">,
  userId: string,
  disputes: DjangoDispute[]
) {
  return (
    transaction.buyerId === userId &&
    Boolean(transaction.paidAt) &&
    !disputes.some(
      (dispute) =>
        dispute.transaction_id === transaction.id && dispute.status === "Open"
    )
  );
}
