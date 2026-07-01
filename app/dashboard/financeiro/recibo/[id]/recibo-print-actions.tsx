"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { resendReceiptPdf } from "@/app/dashboard/financeiro/receipt-actions";
import { toast } from "@/components/ui/toast";

export function ReciboPrintActions({
  receiptId,
  pdfUrl,
  imprimirHref,
}: {
  receiptId: string;
  pdfUrl: string | null;
  imprimirHref?: string;
}) {
  const [resending, setResending] = useState(false);

  const isExternalPdf = pdfUrl?.startsWith("http");
  const downloadUrl = isExternalPdf
    ? pdfUrl!
    : imprimirHref
      ? `${typeof window !== "undefined" ? window.location.origin : ""}${imprimirHref}`
      : null;

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
      {downloadUrl && (
        <Button type="button" className="flex-1 min-w-[120px]" asChild>
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
            {isExternalPdf ? "Baixar PDF" : "Abrir para impressão"}
          </a>
        </Button>
      )}
      <Button
        type="button"
        onClick={() => {
          if (imprimirHref) window.open(imprimirHref, "_blank");
          else window.print();
        }}
        className="flex-1 min-w-[120px]"
      >
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
