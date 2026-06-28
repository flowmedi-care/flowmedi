"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useAudit } from "./audit-context";

export function AuditSessionBanner() {
  const { session } = useAudit();

  if (session?.authenticated) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Sessão ativa</p>
          <p className="mt-1 text-muted-foreground">
            Testes <code className="rounded bg-muted px-1">current_session</code> usarão{" "}
            <strong>{session.email}</strong> ({session.role ?? "sem role"}). Para cobertura RBAC
            completa, configure também <code className="rounded bg-muted px-1">API_AUDIT_*</code> na
            Vercel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div>
        <p className="font-medium text-destructive">Sem sessão no navegador</p>
        <p className="mt-1 text-muted-foreground">
          Faça login em outra aba (ex.:{" "}
          <Link href="/entrar" className="underline">
            /entrar
          </Link>
          ) e recarregue esta página antes de <strong>Executar Auditoria</strong>. Sem login,{" "}
          <code className="rounded bg-muted px-1">current_session</code> equivale a anônimo.
        </p>
      </div>
    </div>
  );
}
