"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { fmtCurrency } from "@/lib/financeiro/format";
import { registerPlanPayment } from "@/app/dashboard/agenda/treatment-plan-actions";

type SessionRow = {
  id: string;
  session_number: number | null;
  scheduled_at: string;
  status: string;
  comanda_status: string | null;
  comanda_id: string | null;
  session_revenue: number;
  paid: boolean;
};

export function PlanoDetalheClient({
  plan,
  patientId,
  patientName,
  sessions,
  bankAccounts,
}: {
  plan: {
    id: string;
    name: string;
    total_amount: number;
    paid_amount: number;
    sessions_total: number;
    sessions_used: number;
    payment_policy: string | null;
    status: string;
  };
  patientId: string;
  patientName: string;
  sessions: SessionRow[];
  bankAccounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("pix");
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? "");
  const [paying, setPaying] = useState(false);

  const remainder = Math.max(0, plan.total_amount - plan.paid_amount);
  const perSession = plan.total_amount / Math.max(1, plan.sessions_total);
  const isPerSession = plan.payment_policy === "por_sessao";

  async function handlePayment() {
    const amount = parseFloat(payAmount.replace(",", "."));
    if (!amount || amount <= 0) {
      toast("Informe um valor válido.", "error");
      return;
    }
    if (!bankAccountId) {
      toast("Selecione a conta bancária.", "error");
      return;
    }
    setPaying(true);
    const res = await registerPlanPayment(plan.id, amount, payMethod, {
      bank_account_id: bankAccountId,
    });
    setPaying(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Pagamento registrado.", "success");
      setPayAmount("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{plan.status}</Badge>
            {plan.payment_policy && <Badge variant="secondary">{plan.payment_policy}</Badge>}
            {remainder <= 0.009 && plan.payment_policy !== "por_sessao" && (
              <Badge className="bg-green-600">Quitado</Badge>
            )}
          </div>
          <p>
            Paciente:{" "}
            <Link href={`/dashboard/contatos/pacientes/${patientId}`} className="text-primary hover:underline">
              {patientName}
            </Link>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">Valor total</p>
              <p className="font-semibold">{fmtCurrency(plan.total_amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Recebido</p>
              <p className="font-semibold">{fmtCurrency(plan.paid_amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Saldo do plano</p>
              <p className="font-semibold">{fmtCurrency(remainder)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Por sessão (rateio)</p>
              <p className="font-semibold">{fmtCurrency(perSession)}</p>
            </div>
          </div>
          <p className="text-muted-foreground">
            Progresso: {plan.sessions_used}/{plan.sessions_total} sessões utilizadas
          </p>
        </CardContent>
      </Card>

      {!isPerSession && remainder > 0.009 && bankAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Registrar pagamento do plano</h2>
          </CardHeader>
          <CardContent className="space-y-3 max-w-md">
            <div className="space-y-1">
              <Label>Valor (máx. {fmtCurrency(remainder)})</Label>
              <Input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1">
              <Label>Forma</Label>
              <select
                className="h-9 w-full rounded-md border px-2 text-sm"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao_credito">Cartão crédito</option>
                <option value="cartao_debito">Cartão débito</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Conta bancária</Label>
              <select
                className="h-9 w-full rounded-md border px-2 text-sm"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handlePayment} disabled={paying}>
              {paying ? "Registrando..." : "Registrar pagamento"}
            </Button>
          </CardContent>
        </Card>
      )}

      {sessions.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Sessões na agenda</h2>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Sessão</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Comanda</th>
                  <th className="py-2 pr-3">Rateio</th>
                  {isPerSession && <th className="py-2">Cobrança</th>}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">{s.session_number ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {new Date(s.scheduled_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2 pr-3">{s.status}</td>
                    <td className="py-2 pr-3">{s.comanda_status ?? "—"}</td>
                    <td className="py-2 pr-3">{fmtCurrency(s.session_revenue)}</td>
                    {isPerSession && (
                      <td className="py-2">
                        {s.paid ? (
                          <Badge variant="secondary">Paga</Badge>
                        ) : s.comanda_status === "aberta" || s.comanda_status === "parcial" ? (
                          <Badge variant="outline">Saldo a recolher</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
