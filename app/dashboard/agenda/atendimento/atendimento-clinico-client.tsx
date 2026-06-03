"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { calcPatientAge } from "@/app/dashboard/pacientes/profile-types";
import {
  ensureAppointmentFichas,
  finalizeClinicalEncounter,
} from "../clinical-ficha-actions";
import {
  getFormReportsForAtendimento,
  type FormReportItem,
} from "../consulta/[id]/formularios-consulta-actions";
import type { AppointmentFichaInstance } from "@/lib/clinical-ficha-types";
import { FichaFieldsPanel } from "./ficha-fields-panel";
import {
  AtendimentoRelatorioPanel,
  VincularRelatorioAtendimento,
} from "./atendimento-relatorio-panel";
import { ClinicalDocumentsClient } from "@/app/dashboard/clinical-documents/clinical-documents-client";
import { AtendimentoClient } from "../consulta/[id]/atendimento-client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  ArrowLeft,
  ClipboardList,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  User,
} from "lucide-react";

type ActivePanel =
  | { kind: "ficha"; id: string }
  | { kind: "relatorio"; id: string }
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
  autoFinalize?: boolean;
}) {
  const router = useRouter();
  const [fichas, setFichas] = useState<AppointmentFichaInstance[]>([]);
  const [relatorios, setRelatorios] = useState<FormReportItem[]>([]);
  const [loadingFichas, setLoadingFichas] = useState(true);
  const [loadingRelatorios, setLoadingRelatorios] = useState(true);
  const [active, setActive] = useState<ActivePanel>(null);
  const [comandaOpen, setComandaOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finalizing, setFinalizing] = useState(false);

  const age = calcPatientAge(patientBirthDate);

  async function loadFichas() {
    setLoadingFichas(true);
    const res = await ensureAppointmentFichas(appointmentId);
    setLoadingFichas(false);
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    setFichas(res.data);
    setActive((prev) => {
      if (prev) return prev;
      if (res.data.length > 0) return { kind: "ficha", id: res.data[0].id };
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
    await Promise.all([loadFichas(), loadRelatorios()]);
  }

  useEffect(() => {
    loadAll();
  }, [appointmentId, patientId]);

  useEffect(() => {
    if (autoFinalize) setComandaOpen(true);
  }, [autoFinalize]);

  useEffect(() => {
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [appointmentId]);

  const activeFicha =
    active?.kind === "ficha" ? fichas.find((f) => f.id === active.id) ?? null : null;
  const activeRelatorio =
    active?.kind === "relatorio"
      ? relatorios.find((r) => r.id === active.id) ?? null
      : null;

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
      router.refresh();
    }
  }

  const relatoriosConsulta = relatorios.filter((r) => r.is_current_appointment);
  const relatoriosOutros = relatorios.filter((r) => !r.is_current_appointment);

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] border rounded-lg overflow-hidden bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/agenda">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Agenda
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="font-semibold truncate">{patientName}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(scheduledAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {doctorName && ` · ${doctorName}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/agenda/consulta/${appointmentId}`}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Consulta
            </Link>
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => setComandaOpen(true)}>
              <CreditCard className="h-4 w-4 mr-1" />
              Finalizar comanda
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r bg-muted/20 shrink-0 flex flex-col max-h-[55vh] md:max-h-none">
          <div className="p-4 border-b flex items-center gap-3 shrink-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
              {patientPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={patientPhotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{patientName}</p>
              {age != null && (
                <p className="text-xs text-muted-foreground">{age} anos</p>
              )}
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-2 space-y-3">
            {/* Fichas clínicas */}
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Fichas de atendimento
              </p>
              {loadingFichas && (
                <p className="text-sm text-muted-foreground p-3">Carregando…</p>
              )}
              {!loadingFichas && fichas.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1">
                  Nenhuma ficha configurada.
                </p>
              )}
              <div className="space-y-0.5">
                {fichas.map((f, idx) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActive({ kind: "ficha", id: f.id })}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between gap-2",
                      active?.kind === "ficha" && active.id === f.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <span className="truncate">
                      {String(idx + 1).padStart(2, "0")}. {f.template.name}
                    </span>
                    {f.status === "concluida" && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        OK
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Relatórios / formulários */}
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <ClipboardList className="h-3 w-3" />
                Relatórios do paciente
              </p>
              {loadingRelatorios && (
                <p className="text-sm text-muted-foreground p-3">Carregando…</p>
              )}
              {!loadingRelatorios && relatorios.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1">
                  Nenhum relatório vinculado.
                </p>
              )}

              {relatoriosConsulta.length > 0 && (
                <p className="text-[10px] text-muted-foreground px-2 pt-1">Esta consulta</p>
              )}
              <div className="space-y-0.5">
                {relatoriosConsulta.map((r) => (
                  <RelatorioSidebarItem
                    key={r.id}
                    report={r}
                    active={active?.kind === "relatorio" && active.id === r.id}
                    onSelect={() => setActive({ kind: "relatorio", id: r.id })}
                  />
                ))}
              </div>

              {relatoriosOutros.length > 0 && (
                <p className="text-[10px] text-muted-foreground px-2 pt-2">Outras consultas</p>
              )}
              <div className="space-y-0.5">
                {relatoriosOutros.map((r) => (
                  <RelatorioSidebarItem
                    key={r.id}
                    report={r}
                    active={active?.kind === "relatorio" && active.id === r.id}
                    onSelect={() => setActive({ kind: "relatorio", id: r.id })}
                    showDate
                  />
                ))}
              </div>
            </div>
          </nav>

          {(canEdit || isDoctor) && (
            <VincularRelatorioAtendimento
              appointmentId={appointmentId}
              onLinked={() => {
                loadRelatorios();
                router.refresh();
              }}
            />
          )}
        </aside>

        <main className="flex-1 overflow-y-auto p-6 min-h-[300px]">
          {activeFicha?.template.ficha_type === "fields" && (
            <FichaFieldsPanel
              key={activeFicha.id}
              instanceId={activeFicha.id}
              templateName={activeFicha.template.name}
              definition={activeFicha.template.definition}
              initialResponses={activeFicha.responses}
              locked={false}
            />
          )}
          {activeFicha?.template.ficha_type === "prescription" && isDoctor && (
            <ClinicalDocumentsClient
              type="prescription"
              patientId={patientId}
              appointmentId={appointmentId}
              isDoctor={isDoctor}
            />
          )}
          {activeFicha?.template.ficha_type === "exam_request" && isDoctor && (
            <ClinicalDocumentsClient
              type="exam_request"
              patientId={patientId}
              appointmentId={appointmentId}
              isDoctor={isDoctor}
            />
          )}
          {activeFicha &&
            (activeFicha.template.ficha_type === "prescription" ||
              activeFicha.template.ficha_type === "exam_request") &&
            !isDoctor && (
              <p className="text-sm text-muted-foreground">
                Apenas o profissional pode preencher esta ficha.
              </p>
            )}

          {activeRelatorio && (
            <AtendimentoRelatorioPanel
              report={activeRelatorio}
              isDoctor={isDoctor}
              onUpdated={loadRelatorios}
            />
          )}

          {!active && !loadingFichas && !loadingRelatorios && (
            <p className="text-muted-foreground text-sm">
              Selecione uma ficha ou relatório na barra lateral.
            </p>
          )}
        </main>
      </div>

      <footer className="border-t px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {fmtTime(elapsed)}
        </div>
        <div className="flex gap-2">
          {canEdit && isDoctor && (
            <Button variant="default" onClick={handleFinalizeClinical} disabled={finalizing}>
              {finalizing ? "Finalizando…" : "Finalizar atendimento"}
            </Button>
          )}
        </div>
      </footer>

      <Dialog open={comandaOpen} onOpenChange={setComandaOpen}>
        <DialogContent
          title="Comanda e cobrança"
          onClose={() => setComandaOpen(false)}
          className="max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <AtendimentoClient
            appointmentId={appointmentId}
            appointmentValor={appointmentValor}
            canEdit={canEdit}
            autoFinalize={autoFinalize}
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
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted/60"
      )}
    >
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
          className={cn("text-[10px] shrink-0", active && "bg-primary-foreground/20 text-inherit")}
        >
          {badgeLabel}
        </Badge>
      </div>
      {showDate && report.scheduled_at && (
        <p
          className={cn(
            "text-[10px] mt-0.5 truncate",
            active ? "text-primary-foreground/80" : "text-muted-foreground"
          )}
        >
          {new Date(report.scheduled_at).toLocaleDateString("pt-BR")}
        </p>
      )}
    </button>
  );
}
