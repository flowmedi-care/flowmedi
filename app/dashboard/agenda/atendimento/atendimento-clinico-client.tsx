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
import type { AppointmentFichaInstance } from "@/lib/clinical-ficha-types";
import { FichaFieldsPanel } from "./ficha-fields-panel";
import { ClinicalDocumentsClient } from "@/app/dashboard/clinical-documents/clinical-documents-client";
import { AtendimentoClient } from "../consulta/[id]/atendimento-client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  ArrowLeft,
  Clock,
  CreditCard,
  ExternalLink,
  User,
} from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [comandaOpen, setComandaOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finalizing, setFinalizing] = useState(false);

  const age = calcPatientAge(patientBirthDate);

  async function load() {
    setLoading(true);
    const res = await ensureAppointmentFichas(appointmentId);
    setLoading(false);
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    setFichas(res.data);
    if (!activeId && res.data.length > 0) {
      setActiveId(res.data[0].id);
    }
  }

  useEffect(() => {
    load();
  }, [appointmentId]);

  useEffect(() => {
    if (autoFinalize) setComandaOpen(true);
  }, [autoFinalize]);

  useEffect(() => {
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [appointmentId]);

  const active = fichas.find((f) => f.id === activeId) ?? fichas[0] ?? null;

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

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] border rounded-lg overflow-hidden bg-background">
      {/* Header */}
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
        {/* Sidebar fichas */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r bg-muted/20 shrink-0">
          <div className="p-4 border-b flex items-center gap-3">
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
          <nav className="p-2 space-y-0.5 max-h-[50vh] md:max-h-none overflow-y-auto">
            {loading && (
              <p className="text-sm text-muted-foreground p-3">Carregando fichas…</p>
            )}
            {!loading && fichas.length === 0 && (
              <p className="text-sm text-muted-foreground p-3">
                Nenhuma ficha configurada. Cadastre em Cadastro Clínico → Fichas de atendimento.
              </p>
            )}
            {fichas.map((f, idx) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveId(f.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors flex items-center justify-between gap-2",
                  active?.id === f.id
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
          </nav>
        </aside>

        {/* Painel central */}
        <main className="flex-1 overflow-y-auto p-6 min-h-[300px]">
          {active?.template.ficha_type === "fields" && (
            <FichaFieldsPanel
              instanceId={active.id}
              templateName={active.template.name}
              definition={active.template.definition}
              initialResponses={active.responses}
              canEdit={canEdit && isDoctor}
            />
          )}
          {active?.template.ficha_type === "prescription" && isDoctor && (
            <ClinicalDocumentsClient
              type="prescription"
              patientId={patientId}
              appointmentId={appointmentId}
              isDoctor={isDoctor}
            />
          )}
          {active?.template.ficha_type === "exam_request" && isDoctor && (
            <ClinicalDocumentsClient
              type="exam_request"
              patientId={patientId}
              appointmentId={appointmentId}
              isDoctor={isDoctor}
            />
          )}
          {active &&
            (active.template.ficha_type === "prescription" ||
              active.template.ficha_type === "exam_request") &&
            !isDoctor && (
              <p className="text-sm text-muted-foreground">
                Apenas o profissional pode preencher esta ficha.
              </p>
            )}
          {!active && !loading && (
            <p className="text-muted-foreground text-sm">Selecione uma ficha na barra lateral.</p>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {fmtTime(elapsed)}
        </div>
        <div className="flex gap-2">
          {canEdit && isDoctor && (
            <Button
              variant="default"
              onClick={handleFinalizeClinical}
              disabled={finalizing}
            >
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
