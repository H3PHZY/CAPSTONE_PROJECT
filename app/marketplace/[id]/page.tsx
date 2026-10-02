import { ListingDetail } from "@/components/marketplace/ListingDetail";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolved = await Promise.resolve(params);
  return <ListingDetail id={resolved.id} />;
}
