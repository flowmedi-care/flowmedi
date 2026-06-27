"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { calcPatientAge } from "@/app/dashboard/pacientes/profile-types";
import {
  ensureAppointmentFichas,
  finalizeClinicalEncounter,
  getPatientFichaHistoryForAtendimento,
} from "../clinical-ficha-actions";
import {
  getFormReportsForAtendimento,
  type FormReportItem,
} from "../consulta/[id]/formularios-consulta-actions";
import type { AppointmentFichaInstance, FichaCopySource, FichaHistoryAppointment } from "@/lib/clinical-ficha-types";
import { FichaFieldsPanel } from "./ficha-fields-panel";
import { FichaHistorySidebar } from "./ficha-history-sidebar";
import { CopyFichasDialog } from "./copy-fichas-dialog";
import {
  AtendimentoRelatorioPanel,
  VincularRelatorioAtendimento,
} from "./atendimento-relatorio-panel";
import { ClinicalDocumentsClient } from "@/app/dashboard/clinical-documents/clinical-documents-client";
import { AtendimentoClient } from "../consulta/[id]/atendimento-client";
import { getAppointmentConsumption } from "../encounter-actions";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { AppPageHeader } from "@/components/app-page-header";
import { AppointmentEncounterNav } from "@/components/appointment-encounter-nav";
import { ConsultationNotesClient } from "../consulta/[id]/consultation-notes-client";
import { ExamesClient } from "@/app/dashboard/exames/exames-client";
import { ClinicalTranscriptionPanel } from "./clinical-transcription-panel";
import { ClinicalNavItem, ClinicalNavSection } from "./clinical-nav-item";
import {
  ClipboardList,
  Clock,
  Copy,
  CreditCard,
  FileText,
  FolderOpen,
  MessageSquare,
  Mic,
  User,
} from "lucide-react";

type ActivePanel =
  | { kind: "ficha"; id: string; scope: "current" | "history" }
  | { kind: "relatorio"; id: string }
  | { kind: "notas" }
  | { kind: "transcricao" }
  | { kind: "arquivos" }
  | null;

const RELATORIO_STATUS: Record<string, string> = {
  pendente: "Pendente",
  respondido: "OK",
  incompleto: "Incompleto",
};

export function AtendimentoClinicoClient({
  appointmentId,
  patientId,
  patientName,
  patientBirthDate,
  patientPhotoUrl,
  scheduledAt,
  doctorName,
  appointmentValor,
  canEdit,
  isDoctor,
  currentUserId,
  autoFinalize,
}: {
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientBirthDate: string | null;
  patientPhotoUrl: string | null;
  scheduledAt: string;
  doctorName: string | null;
  appointmentValor: number | null;
  canEdit: boolean;
  isDoctor: boolean;
  currentUserId: string | null;
  autoFinalize?: boolean;
}) {
  const router = useRouter();
  const [fichas, setFichas] = useState<AppointmentFichaInstance[]>([]);
  const [previousAppointments, setPreviousAppointments] = useState<FichaHistoryAppointment[]>([]);
  const [copySources, setCopySources] = useState<FichaCopySource[]>([]);
  const [relatorios, setRelatorios] = useState<FormReportItem[]>([]);
  const [loadingFichas, setLoadingFichas] = useState(true);
  const [loadingRelatorios, setLoadingRelatorios] = useState(true);
  const [active, setActive] = useState<ActivePanel>(null);
  const [comandaOpen, setComandaOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyPreselectedTemplateId, setCopyPreselectedTemplateId] = useState<string | null>(null);
  const [encounterStatus, setEncounterStatus] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finalizing, setFinalizing] = useState(false);

  const age = calcPatientAge(patientBirthDate);

  async function loadFichas() {
    setLoadingFichas(true);
    const res = await getPatientFichaHistoryForAtendimento(patientId, appointmentId);
    setLoadingFichas(false);
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    setFichas(res.current);
    setPreviousAppointments(res.previous);
    setCopySources(res.copySources);
    setActive((prev) => {
      if (prev) return prev;
      if (res.current.length > 0) {
        return { kind: "ficha", id: res.current[0].id, scope: "current" };
      }
      return null;
    });
  }

  async function loadRelatorios() {
    setLoadingRelatorios(true);
    const res = await getFormReportsForAtendimento(appointmentId, patientId);
    setLoadingRelatorios(false);
    if (res.error) toast(res.error, "error");
    else setRelatorios(res.data);
  }

  async function loadAll() {
    await ensureAppointmentFichas(appointmentId);
    await Promise.all([loadFichas(), loadRelatorios()]);
  }

  function openCopyDialog(templateId?: string) {
    setCopyPreselectedTemplateId(templateId ?? null);
    setCopyDialogOpen(true);
  }

  const historicalFichas = previousAppointments.flatMap((a) => a.fichas);
  const activeFichaCurrent =
    active?.kind === "ficha" && active.scope === "current"
      ? fichas.find((f) => f.id === active.id) ?? null
      : null;
  const activeFichaHistory =
    active?.kind === "ficha" && active.scope === "history"
      ? historicalFichas.find((f) => f.id === active.id) ?? null
      : null;
  const activeFicha = activeFichaCurrent ?? activeFichaHistory;
  const activeFichaHistoryAppt =
    activeFichaHistory &&
    previousAppointments.find((a) =>
      a.fichas.some((f) => f.id === activeFichaHistory.id)
    );

  useEffect(() => {
    loadAll();
  }, [appointmentId, patientId]);

  useEffect(() => {
    if (autoFinalize) setComandaOpen(true);
  }, [autoFinalize]);

  useEffect(() => {
    getAppointmentConsumption(appointmentId).then((res) => {
      if (!res.error) setEncounterStatus(res.encounter?.status ?? null);
    });
  }, [appointmentId, comandaOpen, finalizing]);

  useEffect(() => {
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [appointmentId]);

  const activeRelatorio =
    active?.kind === "relatorio"
      ? relatorios.find((r) => r.id === active.id) ?? null
      : null;

  const canCopyFichas =
    (canEdit || isDoctor) && copySources.length > 0;
  const isViewingCurrentFicha = active?.kind === "ficha" && active.scope === "current";
  const canEditActiveFicha =
    isViewingCurrentFicha &&
    activeFichaCurrent != null &&
    canEdit &&
    activeFichaCurrent.status !== "concluida";

  function handleFichaSaved(fichaId: string, responses: Record<string, unknown>) {
    setFichas((prev) =>
      prev.map((f) => (f.id === fichaId ? { ...f, responses } : f))
    );
  }

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  async function handleFinalizeClinical() {
    setFinalizing(true);
    const res = await finalizeClinicalEncounter(appointmentId);
    setFinalizing(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Atendimento clínico finalizado.", "success");
      setEncounterStatus("finalizado_aguardando_cobranca");
      router.refresh();
    }
  }

  const relatoriosConsulta = relatorios.filter((r) => r.is_current_appointment);
  const relatoriosOutros = relatorios.filter((r) => !r.is_current_appointment);

  const scheduledLabel = new Date(scheduledAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="surface-elevated overflow-hidden flex flex-col min-h-[calc(100vh-9rem)]">
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border/60">
        <AppPageHeader
          breadcrumbs={[
            { label: "Agenda", href: "/dashboard/agenda" },
            { label: patientName },
          ]}
          backHref="/dashboard/agenda"
          title={patientName}
          description={[scheduledLabel, doctorName].filter(Boolean).join(" · ")}
          variant="contained"
          actions={
            canEdit && encounterStatus === "finalizado_aguardando_cobranca" ? (
              <Button size="sm" variant="outline" onClick={() => setComandaOpen(true)}>
                <CreditCard className="h-4 w-4 mr-1" />
                Finalizar comanda
              </Button>
            ) : undefined
          }
        />
      </div>

      <div className="px-4 sm:px-6 border-b border-border/60 bg-card">
        <AppointmentEncounterNav appointmentId={appointmentId} activeView="clinico" />
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r border-border/60 bg-card shrink-0 flex flex-col max-h-[50vh] md:max-h-none">
          <div className="p-4 border-b border-border/60 flex items-center gap-3 shrink-0 bg-muted/20">
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-border/40">
              {patientPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={patientPhotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{patientName}</p>
              {age != null && (
                <p className="text-xs text-muted-foreground">{age} anos</p>
              )}
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-4">
            <ClinicalNavSection title="Fichas de atendimento" icon={FileText}>
              {loadingFichas && (
                <p className="text-sm text-muted-foreground px-2 py-1">Carregando…</p>
              )}
              {!loadingFichas && fichas.length === 0 && previousAppointments.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1">
                  Nenhuma ficha configurada.
                </p>
              )}
              {!loadingFichas && (fichas.length > 0 || previousAppointments.length > 0) && (
                <FichaHistorySidebar
                  currentFichas={fichas}
                  previousAppointments={previousAppointments}
                  activeFichaId={active?.kind === "ficha" ? active.id : null}
                  onSelectFicha={(id, scope) => setActive({ kind: "ficha", id, scope })}
                  onCopySingleFicha={(templateId) => openCopyDialog(templateId)}
                  canCopy={canCopyFichas}
                />
              )}
            </ClinicalNavSection>

            <ClinicalNavSection title="Relatórios do paciente" icon={ClipboardList}>
              {loadingRelatorios && (
                <p className="text-sm text-muted-foreground px-2 py-1">Carregando…</p>
              )}
              {!loadingRelatorios && relatorios.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1">
                  Nenhum relatório vinculado.
                </p>
              )}

              {relatoriosConsulta.length > 0 && (
                <p className="text-[10px] text-muted-foreground px-2 pt-0.5">Esta consulta</p>
              )}
              {relatoriosConsulta.map((r) => (
                <RelatorioSidebarItem
                  key={r.id}
                  report={r}
                  active={active?.kind === "relatorio" && active.id === r.id}
                  onSelect={() => setActive({ kind: "relatorio", id: r.id })}
                />
              ))}

              {relatoriosOutros.length > 0 && (
                <p className="text-[10px] text-muted-foreground px-2 pt-2">Outras consultas</p>
              )}
              {relatoriosOutros.map((r) => (
                <RelatorioSidebarItem
                  key={r.id}
                  report={r}
                  active={active?.kind === "relatorio" && active.id === r.id}
                  onSelect={() => setActive({ kind: "relatorio", id: r.id })}
                  showDate
                />
              ))}
            </ClinicalNavSection>

            <ClinicalNavSection title="Registro" icon={MessageSquare}>
              <ClinicalNavItem
                active={active?.kind === "notas"}
                onClick={() => setActive({ kind: "notas" })}
              >
                <span className="pl-1">Notas da consulta</span>
              </ClinicalNavItem>
              <ClinicalNavItem
                active={active?.kind === "transcricao"}
                onClick={() => setActive({ kind: "transcricao" })}
              >
                <span className="pl-1 flex items-center gap-2">
                  <Mic className="h-3.5 w-3.5 shrink-0" />
                  Transcrição de áudio
                </span>
              </ClinicalNavItem>
              <ClinicalNavItem
                active={active?.kind === "arquivos"}
                onClick={() => setActive({ kind: "arquivos" })}
              >
                <span className="pl-1 flex items-center gap-2">
                  <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                  Arquivos
                </span>
              </ClinicalNavItem>
            </ClinicalNavSection>
          </nav>

          {(canEdit || isDoctor) && (
            <div className="p-3 border-t border-border/60 shrink-0">
              <VincularRelatorioAtendimento
                appointmentId={appointmentId}
                onLinked={() => {
                  loadRelatorios();
                  router.refresh();
                }}
              />
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto bg-muted/30 p-4 sm:p-5 min-h-[320px]">
          <div className="rounded-xl border border-border/50 bg-card p-4 sm:p-6 min-h-full shadow-sm">
          {isViewingCurrentFicha && canCopyFichas && (
            <div className="mb-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => openCopyDialog()}>
                <Copy className="h-4 w-4 mr-1" />
                Trazer da consulta anterior
              </Button>
            </div>
          )}
          {activeFicha?.template.ficha_type === "fields" && (
            <FichaFieldsPanel
              key={activeFicha.id}
              instanceId={activeFicha.id}
              templateName={activeFicha.template.name}
              definition={activeFicha.template.definition}
              initialResponses={activeFicha.responses}
              interactive={canEditActiveFicha}
              consultationLabel={
                activeFichaHistoryAppt
                  ? `Consulta de ${new Date(activeFichaHistoryAppt.scheduled_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : undefined
              }
              onSaved={
                canEditActiveFicha
                  ? (responses) => handleFichaSaved(activeFicha.id, responses)
                  : undefined
              }
            />
          )}
          {isViewingCurrentFicha && activeFicha?.template.ficha_type === "prescription" && isDoctor && (
            <ClinicalDocumentsClient
              type="prescription"
              patientId={patientId}
              appointmentId={appointmentId}
              isDoctor={isDoctor}
            />
          )}
          {isViewingCurrentFicha && activeFicha?.template.ficha_type === "exam_request" && isDoctor && (
            <ClinicalDocumentsClient
              type="exam_request"
              patientId={patientId}
              appointmentId={appointmentId}
              isDoctor={isDoctor}
            />
          )}
          {isViewingCurrentFicha &&
            activeFicha &&
            (activeFicha.template.ficha_type === "prescription" ||
              activeFicha.template.ficha_type === "exam_request") &&
            !isDoctor && (
              <p className="text-sm text-muted-foreground">
                Apenas o profissional pode preencher esta ficha.
              </p>
            )}

          {activeFichaHistory &&
            activeFicha.template.ficha_type !== "fields" && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">{activeFicha.template.name}</h2>
                <p className="text-sm text-muted-foreground">
                  Documentos de consultas anteriores podem ser visualizados no atendimento
                  completo daquela data.
                </p>
                {activeFichaHistoryAppt && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/agenda/atendimento/${activeFichaHistoryAppt.appointment_id}`}>
                      Abrir atendimento de{" "}
                      {new Date(activeFichaHistoryAppt.scheduled_at).toLocaleDateString("pt-BR")}
                    </Link>
                  </Button>
                )}
              </div>
            )}

          {activeRelatorio && (
            <AtendimentoRelatorioPanel
              report={activeRelatorio}
              isDoctor={isDoctor}
              onUpdated={loadRelatorios}
            />
          )}

          {active?.kind === "notas" && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Registro da consulta</h2>
              <ConsultationNotesClient
                appointmentId={appointmentId}
                canAddPosts={isDoctor || canEdit}
                canEditAnyNote={canEdit}
                currentUserId={currentUserId}
              />
            </div>
          )}

          {active?.kind === "transcricao" && (
            <ClinicalTranscriptionPanel
              appointmentId={appointmentId}
              canRecord={canEdit || isDoctor}
            />
          )}

          {active?.kind === "arquivos" && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Arquivos</h2>
              <ExamesClient
                patientId={patientId}
                appointmentId={appointmentId}
                canEdit={canEdit || isDoctor}
              />
            </div>
          )}

          {!active && !loadingFichas && !loadingRelatorios && (
            <p className="text-muted-foreground text-sm">
              Selecione uma ficha ou relatório na barra lateral.
            </p>
          )}
          </div>
        </main>
      </div>

      <footer className="border-t border-border/60 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {fmtTime(elapsed)}
        </div>
        <div className="flex gap-2">
          {canEdit && isDoctor && encounterStatus === "em_andamento" && (
            <Button variant="default" onClick={handleFinalizeClinical} disabled={finalizing}>
              {finalizing ? "Encerrando…" : "Encerrar atendimento clínico"}
            </Button>
          )}
        </div>
      </footer>

      <CopyFichasDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        targetAppointmentId={appointmentId}
        copySources={copySources}
        preselectedTemplateId={copyPreselectedTemplateId}
        onCopied={() => {
          loadFichas();
          router.refresh();
        }}
      />

      <Dialog open={comandaOpen} onOpenChange={setComandaOpen}>
        <DialogContent
          title="Finalizar comanda"
          onClose={() => setComandaOpen(false)}
          className="max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <AtendimentoClient
            appointmentId={appointmentId}
            appointmentValor={appointmentValor}
            canEdit={canEdit}
            autoFinalize={autoFinalize}
            mode="billing-only"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RelatorioSidebarItem({
  report,
  active,
  onSelect,
  showDate,
}: {
  report: FormReportItem;
  active: boolean;
  onSelect: () => void;
  showDate?: boolean;
}) {
  const badgeLabel = RELATORIO_STATUS[report.status] ?? report.status;
  const isPending = report.status === "pendente" || report.status === "incompleto";

  return (
    <ClinicalNavItem active={active} onClick={onSelect}>
      <div className="pl-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{report.template_name}</span>
          <Badge
            variant={
              report.status === "respondido"
                ? "secondary"
                : isPending
                  ? "outline"
                  : "secondary"
            }
            className="text-[10px] shrink-0"
          >
            {badgeLabel}
          </Badge>
        </div>
        {showDate && report.scheduled_at && (
          <p className="text-[10px] mt-0.5 truncate text-muted-foreground">
            {new Date(report.scheduled_at).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>
    </ClinicalNavItem>
  );
}
