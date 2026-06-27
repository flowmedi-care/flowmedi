"use client";

import { CLINICAL_PDF_LAYOUTS, type ClinicalPdfLayoutId } from "@/lib/clinical-documents/pdf-layouts";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

export function ClinicalLayoutPickerDialog({
  open,
  onClose,
  onSelect,
  title = "Escolha o modelo de impressão",
  description = "O documento será gerado em HTML para impressão e assinatura manual.",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (layoutId: ClinicalPdfLayoutId) => void;
  title?: string;
  description?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={title} onClose={onClose} className="max-w-lg">
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {CLINICAL_PDF_LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              type="button"
              onClick={() => onSelect(layout.id)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
                "hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">{layout.label}</span>
              <span className="text-xs text-muted-foreground leading-relaxed">{layout.description}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function printClinicalHtml(html: string) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) {
    alert("Permita pop-ups para imprimir o documento.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 400);
}
