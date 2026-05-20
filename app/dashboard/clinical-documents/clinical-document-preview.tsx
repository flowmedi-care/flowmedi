"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Eye } from "lucide-react";
import { previewClinicalDocumentHtml } from "./actions";
import type { ClinicalDocumentType, StructuredContent } from "@/lib/clinical-documents/types";

export function ClinicalDocumentPreview({
  type,
  patientId,
  appointmentId,
  bodyText,
  structuredContent,
}: {
  type: ClinicalDocumentType;
  patientId: string;
  appointmentId: string;
  bodyText: string;
  structuredContent: StructuredContent;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const res = await previewClinicalDocumentHtml({
        type,
        patientId,
        appointmentId,
        bodyText,
        structuredContent,
      });
      if (cancelled) return;
      setLoading(false);
      if (res.error) {
        setError(res.error);
        setHtml(null);
      } else {
        setHtml(res.html);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [type, patientId, appointmentId, bodyText, JSON.stringify(structuredContent)]);

  return (
    <Card className="lg:sticky lg:top-4 h-fit">
      <CardHeader className="pb-2">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4" />
          Pré-visualização
        </h3>
        <p className="text-xs text-muted-foreground">
          Atualiza conforme você edita. Pode diferir levemente da impressão final.
        </p>
      </CardHeader>
      <CardContent>
        {loading && (
          <p className="text-sm text-muted-foreground py-8 text-center">Gerando preview...</p>
        )}
        {error && (
          <p className="text-sm text-destructive py-4">{error}</p>
        )}
        {!loading && html && (
          <div className="border rounded-lg overflow-hidden bg-white shadow-inner">
            <iframe
              title="Pré-visualização do documento"
              srcDoc={html}
              className="w-full border-0"
              style={{ height: "min(70vh, 720px)", minHeight: 400 }}
            />
          </div>
        )}
        {!loading && !html && !error && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Adicione conteúdo para ver a pré-visualização.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
