import { getExpenseReceiptData } from "../../expense-receipt-actions";
import { notFound } from "next/navigation";
import { fmtCurrency } from "@/lib/financeiro/format";
import { CATEGORY_LABELS } from "@/lib/financeiro/constants";
import type { ExpenseCategory } from "@/lib/financeiro/types";

export default async function ComprovanteDespesaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, error } = await getExpenseReceiptData(id);
  if (error || !data) notFound();

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-lg mx-auto print:p-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 space-y-4">
        <div className="text-center border-b pb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Comprovante interno — sem valor fiscal</p>
          <h1 className="text-xl font-bold mt-2">{data.clinicName}</h1>
          {data.clinicDocument && <p className="text-sm text-gray-600">CNPJ: {data.clinicDocument}</p>}
        </div>

        <div className="space-y-2 text-sm">
          <p><strong>Nº:</strong> {data.receiptNumber}</p>
          <p><strong>Data:</strong> {data.paidAt ? new Date(data.paidAt).toLocaleString("pt-BR") : "—"}</p>
          <p><strong>Fornecedor:</strong> {data.supplierName}</p>
          <p><strong>Descrição:</strong> {data.description}</p>
          {data.category && (
            <p><strong>Categoria:</strong> {CATEGORY_LABELS[data.category as ExpenseCategory] ?? data.category}</p>
          )}
          {data.paymentMethod && <p><strong>Pagamento:</strong> {data.paymentMethod}</p>}
        </div>

        <div className="text-center py-4 border-t border-b">
          <p className="text-sm text-gray-600">Valor pago</p>
          <p className="text-3xl font-bold">{fmtCurrency(data.amount)}</p>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Documento gerado pela Flowmedi. Não substitui Nota Fiscal eletrônica.
        </p>
      </div>
    </div>
  );
}
