export function effectivePaymentPriceNgn(
  dealPriceNgn: number | null,
  listingPriceNgn: number | null
): number | null {
  const value = dealPriceNgn ?? listingPriceNgn;
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function paymentAmountKobo(priceNgn: number): number | null {
  const amountKobo = Math.round(priceNgn * 100);
  return Number.isSafeInteger(amountKobo) && amountKobo > 0 ? amountKobo : null;
}
