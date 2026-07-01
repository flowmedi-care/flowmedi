"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { sanitizeEmailPreviewHtml } from "@/lib/sanitize-html";

function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function WhatsAppPreviewBubble({
  text,
  sentAt,
  className,
}: {
  text: string;
  sentAt?: string;
  className?: string;
}) {
  const plainText = stripHtmlToPlainText(text);
  const referenceDate = sentAt ? new Date(sentAt) : new Date();
  const timeStr = referenceDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-[#d1ccc6] dark:bg-[#0b141a] p-4 shadow-inner max-w-[96%]",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="rounded-lg px-3 py-2 shadow-md max-w-[320px] bg-[#c6e7b8] dark:bg-[#005c4b]">
          <p className="text-sm text-[#111b21] dark:text-[#e9edef] whitespace-pre-wrap break-words">
            {plainText || "(sem conteúdo)"}
          </p>
          <p className="text-[10px] text-[#667781] dark:text-[#8696a0] text-right mt-1">
            {timeStr}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SentEmailPreviewPanel({
  subject,
  bodyHtml,
  templateName,
  legacyFallback,
  className,
}: {
  subject?: string | null;
  bodyHtml?: string | null;
  templateName?: string | null;
  legacyFallback?: string | null;
  className?: string;
}) {
  const hasHtml = Boolean(bodyHtml?.trim());

  return (
    <Card className={cn("p-4 overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Email enviado
        </p>
        {templateName && (
          <Badge variant="secondary" className="text-xs">
            {templateName}
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Assunto</p>
          <p className="text-sm rounded-md border border-border bg-muted/30 px-3 py-2">
            {subject || "(sem assunto)"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Corpo</p>
          {hasHtml ? (
            <div className="rounded-md border border-border overflow-hidden max-h-[50vh] overflow-y-auto">
              <div
                className="bg-white p-4 text-sm dark:bg-zinc-950 min-h-[120px]"
                dangerouslySetInnerHTML={{ __html: sanitizeEmailPreviewHtml(bodyHtml!) }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {legacyFallback && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Preview limitado — registro antigo sem HTML completo.
                </p>
              )}
              <pre className="text-xs whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 max-h-[40vh] overflow-auto">
                {legacyFallback || "(sem conteúdo)"}
              </pre>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function EmailPreviewPanel({
  subject,
  bodyHtml,
  emailHeader,
  emailFooter,
  className,
}: {
  subject?: string | null;
  bodyHtml: string;
  emailHeader?: string;
  emailFooter?: string;
  className?: string;
}) {
  const previewHtml = `${emailHeader || ""}${bodyHtml || ""}${emailFooter || ""}`;
  const bodyText = (bodyHtml || "").replace(/<[^>]*>/g, "").trim();

  return (
    <Card className={cn("p-3 overflow-auto max-h-[60vh]", className)}>
      <p className="text-xs text-muted-foreground mb-2">
        Preview do email (com cabeçalho/rodapé)
      </p>
      <p className="text-sm rounded bg-muted/50 p-2 mb-3">
        <strong>Assunto:</strong> {subject || "(sem assunto)"}
      </p>
      <p className="text-xs text-muted-foreground mb-2">
        Texto plano: {bodyText || "(vazio)"}
      </p>
      <div
        className="rounded bg-white p-2 text-sm dark:bg-zinc-950"
        dangerouslySetInnerHTML={{
          __html: sanitizeEmailPreviewHtml(previewHtml || "<p>(sem conteúdo)</p>"),
        }}
      />
    </Card>
  );
}
