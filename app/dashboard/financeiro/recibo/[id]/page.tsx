import { redirect, notFound } from "next/navigation";
import { getReceiptPrintData } from "@/app/dashboard/financeiro/receipt-actions";
import { fmtCurrency } from "@/lib/financeiro/format";
import { ReciboPrintActions } from "./recibo-print-actions";

export default async function ReciboPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { error, data } = await getReceiptPrintData(id);
  if (error || !data) notFound();

  return (
    <div className="max-w-lg mx-auto py-10 px-4 space-y-6 print:py-4 relative">
      {data.voided_at && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none print:block">
          <p className="text-4xl font-bold text-destructive/30 rotate-[-20deg]">CANCELADO</p>
        </div>
      )}
      <div className="text-center space-y-1 border-b pb-4">
        <h1 className="text-xl font-semibold">Recibo de pagamento</h1>
        <p className="text-sm text-muted-foreground">{data.receipt_number}</p>
      </div>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Paciente</dt>
          <dd className="font-medium">{data.patient_name}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Valor recebido</dt>
          <dd className="font-semibold text-lg">{fmtCurrency(data.amount)}</dd>
        </div>
        {data.credit_applied != null && data.credit_applied > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Crédito aplicado</dt>
            <dd className="text-green-700">-{fmtCurrency(data.credit_applied)}</dd>
          </div>
        )}
        {data.payment_method && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Forma</dt>
            <dd>{data.payment_method}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Data</dt>
          <dd>
            {data.paid_at
              ? new Date(data.paid_at).toLocaleString("pt-BR")
              : new Date(data.issued_at).toLocaleString("pt-BR")}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground text-center pt-4">
        Documento gerado pelo Flowmedi — comprovante interno, não substitui NF-e/NFC-e.
      </p>
      <ReciboPrintActions receiptId={id} pdfUrl={data.pdf_url} />
    </div>
  );
}
