"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAudit } from "./audit-context";

export function AuditRegistryAlert() {
  const { registryValidation, setRegistryValidation } = useAudit();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dev/audit/validate-registry")
      .then((r) => r.json())
      .then(setRegistryValidation)
      .catch(() => setRegistryValidation(null))
      .finally(() => setLoading(false));
  }, [setRegistryValidation]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Validando paridade do registry…
      </div>
    );
  }

  if (!registryValidation) return null;

  if (registryValidation.inSync) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Registry sincronizado ({registryValidation.registryCount}/{registryValidation.filesystemCount}{" "}
        handlers)
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle className="h-4 w-4" />
        Registry dessincronizado — faltam {registryValidation.missingInRegistry.length} handlers no
        inventário
      </div>
      {registryValidation.missingInRegistry.length > 0 && (
        <ul className="mt-2 max-h-32 overflow-auto text-xs text-muted-foreground">
          {registryValidation.missingInRegistry.slice(0, 10).map((m) => (
            <li key={`${m.method}-${m.path}`}>
              {m.method} {m.path} ({m.file})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
