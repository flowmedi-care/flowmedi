"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getAppointmentPaymentPolicy,
  setAppointmentPaymentPolicy,
  type PaymentPolicy,
} from "../../encounter-actions";
import { toast } from "@/components/ui/toast";
import { ClipboardCheck } from "lucide-react";

const POLICY_LABEL: Record<PaymentPolicy, string> = {
  antecipado: "Pagamento antecipado",
  no_dia: "Pagamento no dia (check-in)",
  pos_atendimento: "Pagamento após atendimento",
};

const POLICY_HINT: Record<PaymentPolicy, string> = {
  antecipado: "Emitir cupom e receber antes ou no momento do check-in.",
  no_dia: "Receber na recepção antes de encaminhar ao médico.",
  pos_atendimento: "Emitir cupom após o atendimento clínico; saldo em contas a receber.",
};

export function CheckInPaymentPolicy({
  appointmentId,
  canEdit,
}: {
  appointmentId: string;
  canEdit: boolean;
}) {
  const [policy, setPolicy] = useState<PaymentPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAppointmentPaymentPolicy(appointmentId).then((res) => {
      setLoading(false);
      if (res.error) toast(res.error, "error");
      else setPolicy(res.policy);
    });
  }, [appointmentId]);

  async function save(next: PaymentPolicy) {
    setSaving(true);
    const res = await setAppointmentPaymentPolicy(appointmentId, next);
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      setPolicy(next);
      toast("Check-in registrado.", "success");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Check-in — pagamento</h3>
        {policy && (
          <Badge variant="outline" className="ml-auto">
            {POLICY_LABEL[policy]}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : !canEdit ? (
          <p className="text-muted-foreground">
            {policy ? POLICY_HINT[policy] : "Política de pagamento não definida."}
          </p>
        ) : (
          <>
            <p className="text-muted-foreground">
              Defina como esta consulta será cobrada antes de encaminhar ao médico.
            </p>
            <div className="flex flex-col gap-2">
              {(Object.keys(POLICY_LABEL) as PaymentPolicy[]).map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant={policy === key ? "default" : "outline"}
                  className="justify-start h-auto py-2 px-3 text-left"
                  disabled={saving}
                  onClick={() => save(key)}
                >
                  <span>
                    <span className="font-medium block">{POLICY_LABEL[key]}</span>
                    <span className="text-xs opacity-80 font-normal">{POLICY_HINT[key]}</span>
                  </span>
                </Button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
