"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { resendReceiptPdf } from "@/app/dashboard/financeiro/receipt-actions";
import { toast } from "@/components/ui/toast";

export function ReciboPrintActions({
  receiptId,
  pdfUrl,
}: {
  receiptId: string;
  pdfUrl: string | null;
}) {
  const [resending, setResending] = useState(false);

  const isExternalPdf = pdfUrl?.startsWith("http");

  async function handleResend() {
    setResending(true);
    const res = await resendReceiptPdf(receiptId);
    setResending(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("PDF regenerado.", "success");
      if (res.pdfUrl?.startsWith("http")) window.open(res.pdfUrl, "_blank");
    }
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {isExternalPdf && (
        <Button type="button" className="flex-1 min-w-[120px]" asChild>
          <a href={pdfUrl!} target="_blank" rel="noopener noreferrer">
            Baixar PDF
          </a>
        </Button>
      )}
      <Button type="button" onClick={() => window.print()} className="flex-1 min-w-[120px]">
        Imprimir
      </Button>
      <Button
        type="button"
        variant="outline"
        className="flex-1 min-w-[120px]"
        onClick={handleResend}
        disabled={resending}
      >
        {resending ? "Gerando…" : "Reenviar PDF"}
      </Button>
    </div>
  );
}
