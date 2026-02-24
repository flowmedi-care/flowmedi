"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { updateComplianceConfirmationDays, updateComplianceFormDays } from "./actions";
import { IntegrationsSection } from "./integrations-section";
import { ClinicInfoTabs } from "@/components/clinic-info/clinic-info-tabs";

export function ConfiguracoesClient({
  clinicName,
  clinicLogoUrl,
  clinicLogoScale,
  clinicPhone,
  clinicEmail,
  clinicAddress,
  clinicWhatsappUrl,
  clinicFacebookUrl,
  clinicInstagramUrl,
  complianceConfirmationDays,
  complianceFormDays,
  clinicId,
}: {
  clinicName: string | null;
  clinicLogoUrl: string | null;
  clinicLogoScale: number;
  clinicPhone: string | null;
  clinicEmail: string | null;
  clinicAddress: string | null;
  clinicWhatsappUrl: string | null;
  clinicFacebookUrl: string | null;
  clinicInstagramUrl: string | null;
  complianceConfirmationDays: number | null;
  complianceFormDays: number | null;
  clinicId: string;
}) {
  const [complianceDays, setComplianceDays] = useState<string>(
    complianceConfirmationDays !== null ? String(complianceConfirmationDays) : ""
  );
  const [complianceFormDaysInput, setComplianceFormDaysInput] = useState<string>(
    complianceFormDays !== null ? String(complianceFormDays) : ""
  );
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceFormLoading, setComplianceFormLoading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const [complianceFormError, setComplianceFormError] = useState<string | null>(null);
  const [activeComplianceTab, setActiveComplianceTab] = useState<"confirmation" | "form">("confirmation");
  const searchParams = useSearchParams();

  // Limpar parâmetros de URL após carregar
  useEffect(() => {
    const integration = searchParams.get("integration");
    const status = searchParams.get("status");

    if ((integration === "whatsapp" || integration === "whatsapp_simple") && status) {
      // Limpar URL após mostrar mensagem de sucesso
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("integration");
        url.searchParams.delete("status");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [searchParams]);

  return (
    <div className="space-y-6 pb-20 min-w-0">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold sm:text-2xl truncate">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as configurações gerais da clínica
        </p>
      </div>

      <ClinicInfoTabs
        clinicId={clinicId}
        initialData={{
          name: clinicName,
          logoUrl: clinicLogoUrl,
          logoScale: clinicLogoScale,
          phone: clinicPhone,
          email: clinicEmail,
          address: clinicAddress,
          whatsappUrl: clinicWhatsappUrl,
          facebookUrl: clinicFacebookUrl,
          instagramUrl: clinicInstagramUrl,
        }}
      />

      <IntegrationsSection clinicId={clinicId} />

      <Card className="overflow-visible">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {activeComplianceTab === "confirmation"
                  ? "Compliance de Confirmação"
                  : "Compliance de Formulário"}
              </h2>
              {activeComplianceTab === "confirmation" ? (
                <p className="text-sm text-muted-foreground break-words">
                  Defina quantos dias antes da consulta ela deve estar confirmada. 
                  Consultas não confirmadas dentro do prazo aparecerão como alerta no dashboard da secretária.
                  Exemplo: se definir 2 dias, uma consulta agendada para dia 17 deve estar confirmada até dia 15.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Defina quantos dias antes da consulta o formulário vinculado deve estar respondido.
                  Quando o prazo passar sem resposta, o sistema cria um evento &quot;Lembrete para Preencher Formulário&quot;
                  na Central de Eventos (e pode enviar email/WhatsApp se estiver automático).
                  Exemplo: se definir 2 dias, um formulário de consulta no dia 17 deve estar preenchido até o dia 15.
                </p>
              )}
            </div>
            <div className="flex gap-2 border-b sm:border border-border rounded-md p-1 bg-muted/50">
              <Button
                variant={activeComplianceTab === "confirmation" ? "default" : "ghost"}
                size="sm"
                className="rounded-b-none sm:rounded-md"
                onClick={() => setActiveComplianceTab("confirmation")}
              >
                Confirmação
              </Button>
              <Button
                variant={activeComplianceTab === "form" ? "default" : "ghost"}
                size="sm"
                className="rounded-b-none sm:rounded-md"
                onClick={() => setActiveComplianceTab("form")}
              >
                Formulário
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeComplianceTab === "confirmation" && (
            <>
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
            </>
          )}

          {activeComplianceTab === "form" && (
            <>
              {complianceFormError && (
                <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                  {complianceFormError}
                </p>
              )}
              <div className="flex items-center gap-4">
                <div className="space-y-2 flex-1 max-w-xs">
                  <Label htmlFor="compliance_form_days">Dias antes da consulta</Label>
                  <Input
                    id="compliance_form_days"
                    type="number"
                    min={0}
                    max={30}
                    value={complianceFormDaysInput}
                    onChange={(e) => setComplianceFormDaysInput(e.target.value)}
                    placeholder="Ex.: 2 (deixe vazio para desabilitar)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para desabilitar a regra de compliance do formulário
                  </p>
                </div>
                <div className="pt-6">
                  <Button
                    onClick={async () => {
                      setComplianceFormError(null);
                      setComplianceFormLoading(true);
                      const daysValue = complianceFormDaysInput.trim() === ""
                        ? null
                        : parseInt(complianceFormDaysInput, 10);

                      if (daysValue !== null && (isNaN(daysValue) || daysValue < 0 || daysValue > 30)) {
                        setComplianceFormError("O número de dias deve estar entre 0 e 30.");
                        setComplianceFormLoading(false);
                        return;
                      }

                      const res = await updateComplianceFormDays(daysValue);
                      if (res.error) {
                        setComplianceFormError(res.error);
                      } else {
                        setComplianceFormError(null);
                      }
                      setComplianceFormLoading(false);
                    }}
                    disabled={complianceFormLoading}
                  >
                    {complianceFormLoading ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
              </div>
              {complianceFormDays !== null && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                  <strong>Configuração atual:</strong> Formulários vinculados devem estar respondidos até{" "}
                  <strong>{complianceFormDays} dia{complianceFormDays !== 1 ? "s" : ""}</strong> antes da data da consulta.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
