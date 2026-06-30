"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAudit } from "./audit-context";
import { getFixtureWarnings, loadFixturesFromEnv } from "@/lib/api-audit/fixtures";
import type { AuditFixtures } from "@/lib/api-audit/types";

const FIELDS: { key: keyof AuditFixtures; label: string }[] = [
  { key: "clinicSlug", label: "Clinic slug" },
  { key: "contactSlug", label: "Contact slug" },
  { key: "planId", label: "Plan ID (UUID)" },
  { key: "conversationId", label: "Conversation ID" },
  { key: "appointmentId", label: "Appointment ID" },
  { key: "transcriptionId", label: "Transcription ID" },
  { key: "formInstanceId", label: "Form instance ID" },
  { key: "suggestionId", label: "Suggestion ID" },
  { key: "suggestionToken", label: "Suggestion token" },
  { key: "cronSecret", label: "Cron secret" },
  { key: "metaVerifyToken", label: "Meta verify token" },
];

export function FixturesPanel() {
  const { fixtures, setFixtures } = useAudit();
  const [local, setLocal] = useState<Partial<AuditFixtures>>(fixtures);

  const warnings = useMemo(
    () => getFixtureWarnings(loadFixturesFromEnv({ ...fixtures, ...local })),
    [fixtures, local]
  );

  function save() {
    setFixtures(local);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fixtures de teste</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Defaults do .env / Vercel (<code className="rounded bg-muted px-1">API_AUDIT_*</code>)
          com override salvo no navegador. Use IDs reais de homologação para testes mais precisos.
        </p>
        {warnings.length > 0 && (
          <ul className="list-inside list-disc space-y-1 text-xs text-amber-700 dark:text-amber-400">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`fixture-${key}`}>{label}</Label>
              <Input
                id={`fixture-${key}`}
                value={String(local[key] ?? fixtures[key] ?? "")}
                onChange={(e) => setLocal((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" onClick={save}>
          Salvar fixtures
        </Button>
      </CardContent>
    </Card>
  );
}
