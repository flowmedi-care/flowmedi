import { notFound } from "next/navigation";
import { getReceiptPrintData } from "@/app/dashboard/financeiro/receipt-actions";
import { ReceiptBody } from "@/components/financeiro/receipt-body";
import { ReciboPrintActions } from "../recibo-print-actions";

export default async function ReciboImprimirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { error, data } = await getReceiptPrintData(id);
  if (error || !data) notFound();

  return (
    <>
      <div className="print:hidden p-4 max-w-lg mx-auto border-b">
        <ReciboPrintActions
          receiptId={id}
          pdfUrl={data.pdf_url}
          imprimirHref={`/dashboard/financeiro/recibo/${id}/imprimir`}
        />
      </div>
      <ReceiptBody
        data={{
          receipt_number: data.receipt_number,
          clinic_name: data.clinic_name ?? "Clínica",
          clinic_address: data.clinic_address,
          clinic_phone: data.clinic_phone,
          clinic_tax_id: data.clinic_tax_id,
          patient_name: data.patient_name,
          amount: data.amount,
          credit_applied: data.credit_applied,
          payment_method: data.payment_method,
          paid_at: data.paid_at,
          comanda_items: data.comanda_items,
          subtotal_amount: data.subtotal_amount,
          discount_amount: data.discount_amount,
          comanda_total: data.comanda_total,
          comanda_remainder: data.comanda_remainder,
          voided_at: data.voided_at,
        }}
      />
    </>
  );
}
