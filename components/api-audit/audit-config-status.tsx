"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";
import type { AuditConfigStatus } from "@/lib/api-audit/types";

const ROLE_LABELS: { key: keyof AuditConfigStatus["roleCredentials"]; label: string }[] = [
  { key: "admin", label: "Admin" },
  { key: "secretaria", label: "Secretária" },
  { key: "medico", label: "Médico" },
  { key: "system_admin", label: "System admin" },
];

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      {ok ? (
        <Badge variant="outline" className="border-emerald-500/50 text-emerald-700 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Configurado
        </Badge>
      ) : (
        <Badge variant="outline" className="border-amber-500/50 text-amber-700 gap-1">
          <XCircle className="h-3 w-3" />
          Ausente
        </Badge>
      )}
    </div>
  );
}

export function AuditConfigStatusPanel({ config }: { config: AuditConfigStatus | null }) {
  if (!config) return null;

  const rolesConfigured = Object.values(config.roleCredentials).filter(Boolean).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Variáveis de ambiente (servidor)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <StatusRow ok={config.supabase} label="Supabase (URL + anon key)" />
        <StatusRow ok={config.cronSecret} label="CRON_SECRET / API_AUDIT_CRON_SECRET" />
        {ROLE_LABELS.map(({ key, label }) => (
          <StatusRow key={key} ok={config.roleCredentials[key]} label={`API_AUDIT_${key.toUpperCase()}_*`} />
        ))}
        <p className="pt-2 text-xs text-muted-foreground">
          {rolesConfigured === 0
            ? "Papéis omitidos no batch — configure API_AUDIT_*_EMAIL/PASSWORD na Vercel e redeploy."
            : `${rolesConfigured}/4 papéis configurados para testes RBAC.`}
        </p>
      </CardContent>
    </Card>
  );
}
