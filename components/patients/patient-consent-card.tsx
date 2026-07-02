"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  getPatientConsentsAction,
  registerPatientConsentAction,
  revokePatientConsentAction,
} from "@/app/dashboard/pacientes/consent-actions";
import type { ConsentPurpose } from "@/lib/consent/consent-service";
import { Shield } from "lucide-react";

const PURPOSE_LABELS: Record<ConsentPurpose, string> = {
  marketing: "Marketing / promoções",
  communications: "Comunicações gerais",
  data_processing: "Tratamento de dados",
};

type ConsentRow = {
  id: string;
  purpose: string;
  text_accepted: string | null;
  accepted_at: string;
  revoked_at: string | null;
};

export function PatientConsentCard({
  patientId,
  initialConsents,
  defaultConsentText,
}: {
  patientId: string;
  initialConsents: ConsentRow[];
  defaultConsentText: string;
}) {
  const [consents, setConsents] = useState(initialConsents);
  const [purpose, setPurpose] = useState<ConsentPurpose>("marketing");
  const [text, setText] = useState(defaultConsentText);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const res = await getPatientConsentsAction(patientId);
      if (res.data) setConsents(res.data as ConsentRow[]);
    });
  }

  async function handleRegister() {
    if (!text.trim()) {
      toast("Informe o texto do consentimento.", "error");
      return;
    }
    const res = await registerPatientConsentAction(patientId, purpose, text);
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    toast("Consentimento registrado.", "success");
    refresh();
  }

  async function handleRevoke(consentId: string) {
    const res = await revokePatientConsentAction(consentId, patientId);
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    toast("Consentimento revogado.", "success");
    refresh();
  }

  const active = consents.filter((c) => !c.revoked_at);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Consentimentos LGPD
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Mensagens transacionais (agenda, formulários, lembretes) seguem a base legal definida pela
          clínica. Comunicações de marketing exigem consentimento quando o bloqueio está ativo.
        </p>

        {active.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {active.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {PURPOSE_LABELS[c.purpose as ConsentPurpose] ?? c.purpose}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(c.accepted_at).toLocaleString("pt-BR")}
                  </p>
                  {c.text_accepted && (
                    <p className="text-xs mt-1 text-muted-foreground line-clamp-2">
                      {c.text_accepted}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleRevoke(c.id)}
                >
                  Revogar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum consentimento ativo registrado.</p>
        )}

        <div className="space-y-3 pt-2 border-t border-border">
          <div className="space-y-2">
            <Label>Finalidade</Label>
            <Select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as ConsentPurpose)}
            >
              {(Object.keys(PURPOSE_LABELS) as ConsentPurpose[]).map((key) => (
                <option key={key} value={key}>
                  {PURPOSE_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Texto aceito pelo paciente</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>
          <Button type="button" size="sm" disabled={pending} onClick={handleRegister}>
            Registrar consentimento
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
