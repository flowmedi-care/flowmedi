"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useAudit } from "./audit-context";
import type { ApiEndpointDefinition, AuditScenario, AuditTestResult } from "@/lib/api-audit/types";

const SCENARIOS: { id: AuditScenario; label: string }[] = [
  { id: "anonymous", label: "Sem autenticação" },
  { id: "cron_authenticated", label: "Cron (CRON_SECRET)" },
  { id: "current_session", label: "Sessão atual" },
  { id: "admin", label: "Administrador (env)" },
  { id: "secretaria", label: "Secretária (env)" },
  { id: "medico", label: "Médico (env)" },
  { id: "system_admin", label: "System admin (env)" },
];

function statusIcon(status: number) {
  if (status >= 200 && status < 300) return "✅";
  if (status === 401) return "🟡";
  if (status === 403) return "🟠";
  if (status === 404 || status >= 500) return "🔴";
  return "⚪";
}

interface AuditTestResultDialogProps {
  endpoint: ApiEndpointDefinition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditTestResultDialog({
  endpoint,
  open,
  onOpenChange,
}: AuditTestResultDialogProps) {
  const { fixtures, setResult, session } = useAudit();
  const [scenario, setScenario] = useState<AuditScenario>("anonymous");
  const [loading, setLoading] = useState(false);
  const [result, setLocalResult] = useState<AuditTestResult | null>(null);

  async function runTest() {
    if (!endpoint) return;
    setLoading(true);
    setLocalResult(null);
    try {
      const res = await fetch("/api/dev/audit/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId: endpoint.id, scenario, fixtures }),
      });
      const data = await res.json();
      if (data.result) {
        setLocalResult(data.result);
        setResult(data.result);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" title="Testar endpoint">
        {endpoint && (
          <div className="space-y-4">
            <div>
              <p className="font-medium">{endpoint.name}</p>
              <p className="text-sm font-mono text-muted-foreground">{endpoint.pathTemplate}</p>
            </div>

            {session?.authenticated && (
              <p className="text-xs text-muted-foreground">
                Sessão atual: {session.email} ({session.role ?? "sem role"})
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={scenario === s.id ? "default" : "outline"}
                  onClick={() => setScenario(s.id)}
                >
                  {s.label}
                </Button>
              ))}
            </div>

            <Button onClick={runTest} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Executar teste
            </Button>

            {result && (
              <div className="space-y-3 rounded-xl border p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg">{statusIcon(result.status)}</span>
                  <Badge variant="outline">
                    {result.status || "—"} · {result.durationMs}ms
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      result.classification === "critico"
                        ? "border-red-500/50 text-red-600"
                        : result.classification === "atencao"
                          ? "border-yellow-500/50"
                          : "border-emerald-500/50"
                    }
                  >
                    {result.classification}
                  </Badge>
                  {result.skipped && (
                    <Badge variant="secondary">{result.skipReason}</Badge>
                  )}
                </div>

                <div>
                  <p className="font-medium text-muted-foreground">Headers</p>
                  <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-xs">
                    {JSON.stringify(result.headers, null, 2)}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Tamanho: {result.responseSize} bytes</div>
                  <div>Tipo: {result.contentType ?? "—"}</div>
                </div>

                {result.problems.length > 0 && (
                  <ul className="list-disc pl-4 text-destructive">
                    {result.problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}

                <p className="text-muted-foreground">{result.recommendation}</p>

                {result.preview && (
                  <div>
                    <p className="font-medium text-muted-foreground">Prévia (redigida)</p>
                    <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/50 p-2 text-xs">
                      {result.preview}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
