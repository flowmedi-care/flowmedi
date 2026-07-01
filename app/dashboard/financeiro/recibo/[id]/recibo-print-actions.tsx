"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getReceiptSignedUrl,
  resendReceiptPdf,
} from "@/app/dashboard/financeiro/receipt-actions";
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
  const [downloading, setDownloading] = useState(false);

  const hasStoragePdf =
    pdfUrl &&
    !pdfUrl.startsWith("http") &&
    !pdfUrl.startsWith("/dashboard") &&
    !pdfUrl.startsWith("/storage");

  async function openSignedPdf() {
    setDownloading(true);
    const res = await getReceiptSignedUrl(receiptId);
    setDownloading(false);
    if (res.error || !res.url) {
      toast(res.error ?? "Não foi possível abrir o PDF.", "error");
      return;
    }
    window.open(res.url, "_blank");
  }

  async function handleResend() {
    setResending(true);
    const res = await resendReceiptPdf(receiptId);
    setResending(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("PDF regenerado.", "success");
      if (res.pdfUrl && hasStoragePdf) await openSignedPdf();
    }
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {hasStoragePdf ? (
        <Button
          type="button"
          className="flex-1 min-w-[120px]"
          onClick={openSignedPdf}
          disabled={downloading}
        >
          {downloading ? "Abrindo…" : "Baixar PDF"}
        </Button>
      ) : imprimirHref ? (
        <Button type="button" className="flex-1 min-w-[120px]" asChild>
          <a
            href={`${typeof window !== "undefined" ? window.location.origin : ""}${imprimirHref}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir para impressão
          </a>
        </Button>
      ) : null}
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
