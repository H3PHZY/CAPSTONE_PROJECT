import { TransactionDetailPage } from "@/components/transactions/TransactionDetailPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TransactionDetailPage id={id} />;
}