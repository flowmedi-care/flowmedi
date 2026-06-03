/** Preço cobrado do paciente por unidade de produto (venda; senão custo). */
export function productChargeUnitPrice(salePrice: number | null | undefined, cost: number): number {
  if (salePrice != null && salePrice > 0) return salePrice;
  return cost > 0 ? cost : 0;
}

export type BomLineEstimate = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export function sumBomLines(lines: BomLineEstimate[]): number {
  return lines.reduce((s, l) => s + l.line_total, 0);
}

export function computeChargeTotal(serviceAmount: number, materialLines: BomLineEstimate[]): number {
  return Number((serviceAmount + sumBomLines(materialLines)).toFixed(2));
}

export const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
