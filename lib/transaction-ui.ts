import type { TransactionStatus } from "@/lib/models";

export function canManuallyCompleteTransaction(
  status: TransactionStatus | undefined,
  _amountNgn: number | null | undefined,
  paidAt: string | null | undefined
) {
  return status === "Reserved" && Boolean(paidAt);
}
