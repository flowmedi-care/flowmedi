"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { updateComplianceConfirmationDays } from "./actions";
import { LogoUpload } from "./logo-upload";
import { IntegrationsSection } from "./integrations-section";

export function ConfiguracoesClient({
  clinicLogoUrl,
  clinicLogoScale,
  complianceConfirmationDays,
  clinicId,
}: {
  clinicLogoUrl: string | null;
  clinicLogoScale: number;
  complianceConfirmationDays: number | null;
  clinicId: string;
}) {
  const [complianceDays, setComplianceDays] = useState<string>(
    complianceConfirmationDays !== null ? String(complianceConfirmationDays) : ""
  );
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as configurações gerais da clínica
        </p>
      </div>

      <IntegrationsSection clinicId={clinicId} />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Logo da Clínica</h2>
          <p className="text-sm text-muted-foreground">
            A logo da clínica aparecerá no topo dos formulários enviados aos pacientes.
          </p>
        </CardHeader>
        <CardContent>
          <LogoUpload
            currentLogoUrl={clinicLogoUrl}
            currentScale={clinicLogoScale}
            type="clinic"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Compliance de Confirmação</h2>
          <p className="text-sm text-muted-foreground">
            Defina quantos dias antes da consulta ela deve estar confirmada. 
            Consultas não confirmadas dentro do prazo aparecerão como alerta no dashboard da secretária.
            Exemplo: se definir 2 dias, uma consulta agendada para dia 17 deve estar confirmada até dia 15.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {complianceError && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
              {complianceError}
            </p>
          )}
          <div className="flex items-center gap-4">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label htmlFor="compliance_days">Dias antes da consulta</Label>
              <Input
                id="compliance_days"
                type="number"
                min={0}
                max={30}
                value={complianceDays}
                onChange={(e) => setComplianceDays(e.target.value)}
                placeholder="Ex.: 2 (deixe vazio para desabilitar)"
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio para desabilitar a regra de compliance
              </p>
            </div>
            <div className="pt-6">
              <Button
                onClick={async () => {
                  setComplianceError(null);
                  setComplianceLoading(true);
                  const daysValue = complianceDays.trim() === "" 
                    ? null 
                    : parseInt(complianceDays, 10);
                  
                  if (daysValue !== null && (isNaN(daysValue) || daysValue < 0 || daysValue > 30)) {
                    setComplianceError("O número de dias deve estar entre 0 e 30.");
                    setComplianceLoading(false);
                    return;
                  }

                  const res = await updateComplianceConfirmationDays(daysValue);
                  if (res.error) {
                    setComplianceError(res.error);
                  } else {
                    setComplianceError(null);
                  }
                  setComplianceLoading(false);
                }}
                disabled={complianceLoading}
              >
                {complianceLoading ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
          {complianceConfirmationDays !== null && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              <strong>Configuração atual:</strong> Consultas devem estar confirmadas até{" "}
              <strong>{complianceConfirmationDays} dia{complianceConfirmationDays !== 1 ? "s" : ""}</strong> antes da data agendada.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
