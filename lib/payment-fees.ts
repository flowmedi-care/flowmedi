export function calculatePaymentFee(
  grossAmount: number,
  feePercent: number
): { feeAmount: number; netAmount: number } {
  const feeAmount = Number(((grossAmount * feePercent) / 100).toFixed(2));
  return {
    feeAmount,
    netAmount: Number((grossAmount - feeAmount).toFixed(2)),
  };
}
