"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  updateComplianceConfirmationDays,
  updateComplianceFormDays,
  updateWhatsAppOperationalControls,
  updateClinicServicesPricingMode,
  upsertClinicReportGoals,
} from "./actions";
import { IntegrationsSection } from "./integrations-section";
import { ClinicInfoTabs } from "@/components/clinic-info/clinic-info-tabs";

const BRAZIL_TIMEZONE_OPTIONS = [
  { value: "America/Sao_Paulo", label: "Brasilia: GMT+3" },
  { value: "America/Noronha", label: "Fernando de Noronha: GMT+2" },
  { value: "America/Manaus", label: "Manaus: GMT+4" },
  { value: "America/Cuiaba", label: "Cuiaba: GMT+4" },
  { value: "America/Rio_Branco", label: "Rio Branco: GMT+5" },
];

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
  whatsappMonthlyPost24hLimit,
  autoMessageSendStart,
  autoMessageSendEnd,
  autoMessageTimezone,
  servicesPricingMode,
  reportGoals,
  clinicId,
  canUseWhatsApp,
  canUseEmail,
  canUseCustomLogo,
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
  whatsappMonthlyPost24hLimit: number | null;
  autoMessageSendStart: string;
  autoMessageSendEnd: string;
  autoMessageTimezone: string;
  servicesPricingMode: "centralizado" | "descentralizado";
  reportGoals: {
    targetConfirmationPct: number;
    targetAttendancePct: number;
    targetNoShowPct: number;
    targetOccupancyPct: number;
    targetReturnPct: number;
    returnWindowDays: number;
    workingHoursStart: number;
    workingHoursEnd: number;
  };
  clinicId: string;
  canUseWhatsApp: boolean;
  canUseEmail: boolean;
  canUseCustomLogo: boolean;
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
  const [wppLimitInput, setWppLimitInput] = useState<string>(
    whatsappMonthlyPost24hLimit !== null ? String(whatsappMonthlyPost24hLimit) : ""
  );
  const [sendStartInput, setSendStartInput] = useState<string>(
    String(autoMessageSendStart || "08:00:00").slice(0, 5)
  );
  const [sendEndInput, setSendEndInput] = useState<string>(
    String(autoMessageSendEnd || "20:00:00").slice(0, 5)
  );
  const [timezoneInput, setTimezoneInput] = useState<string>(
    autoMessageTimezone || "America/Sao_Paulo"
  );
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [opsSuccess, setOpsSuccess] = useState(false);
  const [servicesModeInput, setServicesModeInput] = useState<"centralizado" | "descentralizado">(
    servicesPricingMode
  );
  const [servicesModeLoading, setServicesModeLoading] = useState(false);
  const [servicesModeError, setServicesModeError] = useState<string | null>(null);
  const [servicesModeSuccess, setServicesModeSuccess] = useState(false);
  const [activeComplianceTab, setActiveComplianceTab] = useState<"confirmation" | "form">("confirmation");
  const [reportGoalsInput, setReportGoalsInput] = useState({
    targetConfirmationPct: String(reportGoals.targetConfirmationPct),
    targetAttendancePct: String(reportGoals.targetAttendancePct),
    targetNoShowPct: String(reportGoals.targetNoShowPct),
    targetOccupancyPct: String(reportGoals.targetOccupancyPct),
    targetReturnPct: String(reportGoals.targetReturnPct),
    returnWindowDays: String(reportGoals.returnWindowDays),
    workingHoursStart: String(reportGoals.workingHoursStart),
    workingHoursEnd: String(reportGoals.workingHoursEnd),
  });
  const [reportGoalsLoading, setReportGoalsLoading] = useState(false);
  const [reportGoalsError, setReportGoalsError] = useState<string | null>(null);
  const [reportGoalsSuccess, setReportGoalsSuccess] = useState(false);
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
        canUseCustomLogo={canUseCustomLogo}
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

      <IntegrationsSection
        clinicId={clinicId}
        canUseWhatsApp={canUseWhatsApp}
        canUseEmail={canUseEmail}
      />

      <Card>
        <CardHeader className="space-y-1">
          <h2 className="text-lg font-semibold">Serviços e valores: modo de gestão</h2>
          <p className="text-sm text-muted-foreground">
            Defina se o cadastro e manutenção de serviços/valores fica somente com admin ou também com os médicos.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {servicesModeError && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{servicesModeError}</p>
          )}
          {servicesModeSuccess && (
            <p className="text-sm text-green-700 dark:text-green-400 bg-green-500/10 p-2 rounded-md">
              Modo de serviços e valores salvo com sucesso.
            </p>
          )}
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="services_pricing_mode">Modo</Label>
            <select
              id="services_pricing_mode"
              value={servicesModeInput}
              onChange={(e) =>
                setServicesModeInput(
                  e.target.value === "centralizado" ? "centralizado" : "descentralizado"
                )
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="centralizado">Centralizado (somente admin)</option>
              <option value="descentralizado">Descentralizado (admin e médico)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Em modo centralizado, o médico não visualiza nem altera a área de serviços e valores.
            </p>
          </div>
          <Button
            disabled={servicesModeLoading}
            onClick={async () => {
              setServicesModeError(null);
              setServicesModeSuccess(false);
              setServicesModeLoading(true);
              const res = await updateClinicServicesPricingMode(servicesModeInput);
              if (res.error) setServicesModeError(res.error);
              else setServicesModeSuccess(true);
              setServicesModeLoading(false);
            }}
          >
            {servicesModeLoading ? "Salvando..." : "Salvar modo de serviços e valores"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <h2 className="text-lg font-semibold">Relatórios: metas e parâmetros</h2>
          <p className="text-sm text-muted-foreground">
            Configure metas da clínica para alertas automáticos e análises da Visão Geral.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {reportGoalsError && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{reportGoalsError}</p>
          )}
          {reportGoalsSuccess && (
            <p className="text-sm text-green-700 dark:text-green-400 bg-green-500/10 p-2 rounded-md">
              Metas de relatórios salvas com sucesso.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goal_confirmation">Meta confirmação (%)</Label>
              <Input
                id="goal_confirmation"
                type="number"
                min={0}
                max={100}
                value={reportGoalsInput.targetConfirmationPct}
                onChange={(e) =>
                  setReportGoalsInput((prev) => ({ ...prev, targetConfirmationPct: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal_attendance">Meta comparecimento (%)</Label>
              <Input
                id="goal_attendance"
                type="number"
                min={0}
                max={100}
                value={reportGoalsInput.targetAttendancePct}
                onChange={(e) =>
                  setReportGoalsInput((prev) => ({ ...prev, targetAttendancePct: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal_noshow">Meta no-show (%)</Label>
              <Input
                id="goal_noshow"
                type="number"
                min={0}
                max={100}
                value={reportGoalsInput.targetNoShowPct}
                onChange={(e) =>
                  setReportGoalsInput((prev) => ({ ...prev, targetNoShowPct: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal_occupancy">Meta ocupação (%)</Label>
              <Input
                id="goal_occupancy"
                type="number"
                min={0}
                max={100}
                value={reportGoalsInput.targetOccupancyPct}
                onChange={(e) =>
                  setReportGoalsInput((prev) => ({ ...prev, targetOccupancyPct: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal_return">Meta retorno (%)</Label>
              <Input
                id="goal_return"
                type="number"
                min={0}
                max={100}
                value={reportGoalsInput.targetReturnPct}
                onChange={(e) =>
                  setReportGoalsInput((prev) => ({ ...prev, targetReturnPct: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal_return_window">Janela de retorno (dias)</Label>
              <Input
                id="goal_return_window"
                type="number"
                min={1}
                max={180}
                value={reportGoalsInput.returnWindowDays}
                onChange={(e) =>
                  setReportGoalsInput((prev) => ({ ...prev, returnWindowDays: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal_work_start">Início horário útil</Label>
              <Input
                id="goal_work_start"
                type="number"
                min={0}
                max={23}
                value={reportGoalsInput.workingHoursStart}
                onChange={(e) =>
                  setReportGoalsInput((prev) => ({ ...prev, workingHoursStart: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal_work_end">Fim horário útil</Label>
              <Input
                id="goal_work_end"
                type="number"
                min={0}
                max={23}
                value={reportGoalsInput.workingHoursEnd}
                onChange={(e) =>
                  setReportGoalsInput((prev) => ({ ...prev, workingHoursEnd: e.target.value }))
                }
              />
            </div>
          </div>
          <Button
            disabled={reportGoalsLoading}
            onClick={async () => {
              setReportGoalsError(null);
              setReportGoalsSuccess(false);
              setReportGoalsLoading(true);

              const parsed = {
                targetConfirmationPct: Number.parseInt(reportGoalsInput.targetConfirmationPct, 10),
                targetAttendancePct: Number.parseInt(reportGoalsInput.targetAttendancePct, 10),
                targetNoShowPct: Number.parseInt(reportGoalsInput.targetNoShowPct, 10),
                targetOccupancyPct: Number.parseInt(reportGoalsInput.targetOccupancyPct, 10),
                targetReturnPct: Number.parseInt(reportGoalsInput.targetReturnPct, 10),
                returnWindowDays: Number.parseInt(reportGoalsInput.returnWindowDays, 10),
                workingHoursStart: Number.parseInt(reportGoalsInput.workingHoursStart, 10),
                workingHoursEnd: Number.parseInt(reportGoalsInput.workingHoursEnd, 10),
              };

              if (Object.values(parsed).some((v) => Number.isNaN(v))) {
                setReportGoalsError("Preencha todos os campos com números válidos.");
                setReportGoalsLoading(false);
                return;
              }

              const res = await upsertClinicReportGoals(parsed);
              if (res.error) setReportGoalsError(res.error);
              else setReportGoalsSuccess(true);
              setReportGoalsLoading(false);
            }}
          >
            {reportGoalsLoading ? "Salvando..." : "Salvar metas de relatórios"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <h2 className="text-lg font-semibold">WhatsApp: custo e janela de envio</h2>
          <p className="text-sm text-muted-foreground">
            Controle limite mensal de conversas iniciadas fora da janela de 24h e horário permitido para envios automáticos.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canUseWhatsApp && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Esta funcionalidade já está disponível para visualização. Ao evoluir de plano, você libera toda a configuração com controle completo.
            </div>
          )}
          {opsError && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
              {opsError}
            </p>
          )}
          {opsSuccess && (
            <p className="text-sm text-green-700 dark:text-green-400 bg-green-500/10 p-2 rounded-md">
              Configurações salvas com sucesso.
            </p>
          )}

          <div className="space-y-2 max-w-sm">
            <Label htmlFor="wpp_limit">Limite mensal (conversas iniciadas após 24h)</Label>
            <Input
              id="wpp_limit"
              type="number"
              min={0}
              value={wppLimitInput}
              onChange={(e) => setWppLimitInput(e.target.value)}
              placeholder="Ex.: 300 (vazio = sem limite)"
              disabled={!canUseWhatsApp}
            />
            <p className="text-xs text-muted-foreground">
              Quando atingir o limite, novos envios por template fora da janela serão bloqueados.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="send_start">Início envio automático</Label>
              <Input
                id="send_start"
                type="time"
                value={sendStartInput}
                onChange={(e) => setSendStartInput(e.target.value)}
                disabled={!canUseWhatsApp}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="send_end">Fim envio automático</Label>
              <Input
                id="send_end"
                type="time"
                value={sendEndInput}
                onChange={(e) => setSendEndInput(e.target.value)}
                disabled={!canUseWhatsApp}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="send_tz">Fuso horário</Label>
              <select
                id="send_tz"
                value={timezoneInput}
                onChange={(e) => setTimezoneInput(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={!canUseWhatsApp}
              >
                {!BRAZIL_TIMEZONE_OPTIONS.some((opt) => opt.value === timezoneInput) && (
                  <option value={timezoneInput}>{`Atual: ${timezoneInput}`}</option>
                )}
                {BRAZIL_TIMEZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            disabled={opsLoading || !canUseWhatsApp}
            onClick={async () => {
              setOpsError(null);
              setOpsSuccess(false);
              setOpsLoading(true);

              const parsedLimit =
                wppLimitInput.trim() === ""
                  ? null
                  : Number.parseInt(wppLimitInput, 10);

              if (
                parsedLimit !== null &&
                (Number.isNaN(parsedLimit) || parsedLimit < 0)
              ) {
                setOpsError("Limite mensal inválido.");
                setOpsLoading(false);
                return;
              }

              const res = await updateWhatsAppOperationalControls({
                monthlyPost24hLimit: parsedLimit,
                autoMessageSendStart: sendStartInput,
                autoMessageSendEnd: sendEndInput,
                autoMessageTimezone: timezoneInput,
              });
              if (res.error) {
                setOpsError(res.error);
              } else {
                setOpsSuccess(true);
              }
              setOpsLoading(false);
            }}
          >
            {opsLoading ? "Salvando..." : "Salvar configurações WhatsApp"}
          </Button>
        </CardContent>
      </Card>

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
                  Consultas não confirmadas dentro do prazo aparecerão como alerta no dashboard do Secretário(a).
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
