"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  listProcedureQuoteSettings,
  updateQuoteAiSettings,
  upsertProcedureQuoteSetting,
  type ProcedureQuoteSettingRow,
} from "./quote-ai-settings-actions";

type Props = {
  initialRows: ProcedureQuoteSettingRow[];
  initialValidityDays: number;
  initialTerms: string | null;
};

export function OrcamentoAiSettings({
  initialRows,
  initialValidityDays,
  initialTerms,
}: Props) {
  const [rows, setRows] = useState(initialRows);
  const [validityDays, setValidityDays] = useState(String(initialValidityDays));
  const [terms, setTerms] = useState(initialTerms ?? "");
  const [pending, startTransition] = useTransition();

  const saveGlobal = () => {
    startTransition(async () => {
      const days = validityDays.trim() ? Number(validityDays) : 15;
      const res = await updateQuoteAiSettings({
        quoteDefaultValidityDays: days,
        quoteDefaultTerms: terms.trim() || null,
      });
      if (res.error) toast(res.error, "error");
      else toast("Configurações de orçamento salvas.", "success");
    });
  };

  const updateRow = (
    procedureId: string,
    patch: Partial<Pick<ProcedureQuoteSettingRow, "pricing_mode">>
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.procedure_id === procedureId ? { ...r, ...patch } : r))
    );
  };

  const saveRow = (row: ProcedureQuoteSettingRow) => {
    startTransition(async () => {
      const res = await upsertProcedureQuoteSetting({
        procedureId: row.procedure_id,
        pricingMode: row.pricing_mode,
        defaultServiceId: row.default_service_id,
        defaultProfessionalId: row.default_professional_id,
      });
      if (res.error) toast(res.error, "error");
      else toast(`Regra salva: ${row.procedure_name}`, "success");
    });
  };

  const reload = () => {
    startTransition(async () => {
      const res = await listProcedureQuoteSettings();
      if (res.data) setRows(res.data);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Orçamento automático (IA)</CardTitle>
          <CardDescription>
            Define validade padrão e se cada procedimento usa preço geral da clínica ou varia por
            médico. A IA pergunta o médico só quando necessário.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Validade padrão (dias)</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Condições padrão (opcional)</Label>
              <Input
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Ex.: Valores sujeitos a alteração conforme avaliação presencial."
              />
            </div>
          </div>
          <Button onClick={saveGlobal} disabled={pending}>
            Salvar padrões globais
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regra por procedimento</CardTitle>
          <CardDescription>
            <strong>Geral da clínica</strong> — envia orçamento sem perguntar médico.{" "}
            <strong>Por médico</strong> — pergunta preferência se houver mais de um profissional.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cadastre procedimentos em Serviços e Valores.</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.procedure_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <span className="font-medium">{row.procedure_name}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={row.pricing_mode}
                    onChange={(e) =>
                      updateRow(row.procedure_id, {
                        pricing_mode: e.target.value as "clinic_general" | "per_doctor",
                      })
                    }
                  >
                    <option value="per_doctor">Preço por médico</option>
                    <option value="clinic_general">Orçamento geral</option>
                  </select>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => saveRow(row)}>
                    Salvar
                  </Button>
                </div>
              </div>
            ))
          )}
          <Button variant="ghost" size="sm" onClick={reload} disabled={pending}>
            Recarregar lista
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
