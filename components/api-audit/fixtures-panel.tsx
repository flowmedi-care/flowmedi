"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAudit } from "./audit-context";
import type { AuditFixtures } from "@/lib/api-audit/types";

const FIELDS: { key: keyof AuditFixtures; label: string }[] = [
  { key: "clinicSlug", label: "Clinic slug" },
  { key: "planId", label: "Plan ID (UUID)" },
  { key: "conversationId", label: "Conversation ID" },
  { key: "appointmentId", label: "Appointment ID" },
  { key: "transcriptionId", label: "Transcription ID" },
  { key: "formInstanceId", label: "Form instance ID" },
  { key: "suggestionToken", label: "Suggestion token" },
  { key: "cronSecret", label: "Cron secret" },
  { key: "metaVerifyToken", label: "Meta verify token" },
];

export function FixturesPanel() {
  const { fixtures, setFixtures } = useAudit();
  const [local, setLocal] = useState<Partial<AuditFixtures>>(fixtures);

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
          Defaults do .env.local com override salvo no navegador. Use IDs reais de homologação
          para testes mais precisos.
        </p>
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
