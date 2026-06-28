import { notFound } from "next/navigation";
import { isApiAuditEnabled } from "@/lib/api-audit/guard";

export default function DevApiValidationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isApiAuditEnabled()) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Painel interno — desative ENABLE_API_AUDIT_PANEL na Vercel após a auditoria
        </p>
      </div>
      {children}
    </div>
  );
}
