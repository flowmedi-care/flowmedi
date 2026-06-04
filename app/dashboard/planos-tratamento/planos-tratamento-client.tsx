"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createTreatmentPlan,
  type TreatmentPlanRow,
} from "@/app/dashboard/agenda/treatment-plan-actions";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { fmtCurrency } from "@/lib/financeiro/format";

export function PlanosTratamentoClient({ initialPlans }: { initialPlans: TreatmentPlanRow[] }) {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [sessions, setSessions] = useState("10");
  const [policy, setPolicy] = useState<"antecipado" | "parcelado" | "por_sessao">("antecipado");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!patientId.trim() || !name.trim()) {
      toast("Informe paciente (UUID) e nome do plano.", "error");
      return;
    }
    setSaving(true);
    const res = await createTreatmentPlan({
      patient_id: patientId.trim(),
      name: name.trim(),
      total_amount: parseFloat(total.replace(",", ".")) || 0,
      sessions_total: parseInt(sessions, 10) || 1,
      payment_policy: policy,
    });
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Plano criado.", "success");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Planos ativos</h2>
        </CardHeader>
        <CardContent>
          {initialPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum plano de tratamento. Crie um pacote multi-sessão abaixo.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {initialPlans.map((p) => (
                <li key={p.id} className="py-3 flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-muted-foreground">{p.patient_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sessões: {p.sessions_used}/{p.sessions_total}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{p.status}</Badge>
                    <p className="font-medium mt-1">{fmtCurrency(p.total_amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      Pago: {fmtCurrency(p.paid_amount)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Novo plano de tratamento</h2>
          <p className="text-sm text-muted-foreground">
            Pacote multi-sessão com política de pagamento (antecipado, parcelado ou por sessão).
          </p>
        </CardHeader>
        <CardContent className="space-y-3 max-w-lg">
          <div className="space-y-1">
            <Label>ID do paciente (UUID)</Label>
            <Input value={patientId} onChange={(e) => setPatientId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Nome do plano</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: 10 sessões laser" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Valor total (R$)</Label>
              <Input value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Sessões</Label>
              <Input value={sessions} onChange={(e) => setSessions(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Política de pagamento</Label>
            <select
              className="h-9 w-full rounded-md border px-2 text-sm"
              value={policy}
              onChange={(e) => setPolicy(e.target.value as typeof policy)}
            >
              <option value="antecipado">Antecipado (à vista no plano)</option>
              <option value="parcelado">Parcelado</option>
              <option value="por_sessao">Por sessão</option>
            </select>
          </div>
          <Button onClick={handleCreate} disabled={saving}>
            Criar plano
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
