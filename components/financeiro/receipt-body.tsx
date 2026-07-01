import { fmtCurrency } from "@/lib/financeiro/format";

export type ReceiptBodyData = {
  receipt_number: string;
  clinic_name: string;
  clinic_address?: string | null;
  clinic_phone?: string | null;
  clinic_tax_id?: string | null;
  patient_name: string;
  amount: number;
  credit_applied?: number | null;
  payment_method?: string | null;
  paid_at?: string | null;
  comanda_items?: {
    label: string;
    quantity: number;
    amount: number;
  }[];
  subtotal_amount?: number | null;
  discount_amount?: number | null;
  comanda_total?: number | null;
  comanda_remainder?: number | null;
  voided_at?: string | null;
};

export function ReceiptBody({ data }: { data: ReceiptBodyData }) {
  return (
    <article className="receipt-document mx-auto max-w-lg space-y-6 bg-white p-8 text-gray-900">
      {data.voided_at && (
        <div className="pointer-events-none flex justify-center">
          <p className="text-4xl font-bold text-red-500/40 -rotate-12">CANCELADO</p>
        </div>
      )}
      <header className="border-b border-gray-200 pb-4 text-center">
        <h1 className="text-xl font-bold tracking-tight">{data.clinic_name}</h1>
        {data.clinic_address ? (
          <p className="mt-1 text-xs text-gray-600">{data.clinic_address}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap justify-center gap-x-3 text-xs text-gray-600">
          {data.clinic_phone ? <span>{data.clinic_phone}</span> : null}
          {data.clinic_tax_id ? <span>CNPJ/CPF: {data.clinic_tax_id}</span> : null}
        </div>
        <h2 className="mt-4 text-lg font-semibold">Recibo de pagamento</h2>
        <p className="text-sm text-gray-500">{data.receipt_number}</p>
      </header>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">Paciente</dt>
          <dd className="font-medium text-right">{data.patient_name}</dd>
        </div>
        {data.comanda_items && data.comanda_items.length > 0 ? (
          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Procedimentos e serviços
            </dt>
            {data.comanda_items.map((item, i) => (
              <div key={i} className="flex justify-between gap-2">
                <dd className="text-gray-600 truncate">
                  {item.label}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                </dd>
                <dd>{fmtCurrency(item.amount)}</dd>
              </div>
            ))}
            {data.discount_amount != null && data.discount_amount > 0 && (
              <>
                {data.subtotal_amount != null && (
                  <div className="flex justify-between gap-2 pt-1">
                    <dd className="text-gray-500">Subtotal</dd>
                    <dd>{fmtCurrency(data.subtotal_amount)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2 text-amber-700">
                  <dd>Desconto</dd>
                  <dd>-{fmtCurrency(data.discount_amount)}</dd>
                </div>
              </>
            )}
            {data.comanda_total != null && (
              <div className="flex justify-between gap-2 font-semibold border-t border-gray-200 pt-2">
                <dd>Total da comanda</dd>
                <dd>{fmtCurrency(data.comanda_total)}</dd>
              </div>
            )}
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-gray-200 pt-3">
          <dt className="text-gray-500">Valor recebido</dt>
          <dd className="text-lg font-bold">{fmtCurrency(data.amount)}</dd>
        </div>
        {data.credit_applied != null && data.credit_applied > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Crédito aplicado</dt>
            <dd>-{fmtCurrency(data.credit_applied)}</dd>
          </div>
        )}
        {data.payment_method ? (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Forma</dt>
            <dd className="capitalize">{data.payment_method}</dd>
          </div>
        ) : null}
        {data.paid_at ? (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Data</dt>
            <dd>{new Date(data.paid_at).toLocaleString("pt-BR")}</dd>
          </div>
        ) : null}
        {data.comanda_remainder != null && data.comanda_remainder > 0 && (
          <div className="flex justify-between gap-4 text-amber-800">
            <dt>Saldo pendente</dt>
            <dd className="font-medium">{fmtCurrency(data.comanda_remainder)}</dd>
          </div>
        )}
      </dl>

      <footer className="border-t border-gray-200 pt-4 text-center text-xs text-gray-500">
        Documento gerado pelo Flowmedi — comprovante interno, não substitui NF-e/NFC-e.
      </footer>
    </article>
  );
}
