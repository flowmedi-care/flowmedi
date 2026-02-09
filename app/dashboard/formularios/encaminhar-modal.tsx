"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  getAppointmentsByPatient,
  ensureFormInstanceAndGetLink,
  type AppointmentOption,
} from "./actions";
import { Send, Copy, Check, X } from "lucide-react";

type PatientOption = { id: string; full_name: string };

export function EncaminharModal({
  templateId,
  templateName,
  patients,
  onClose,
}: {
  templateId: string;
  templateName: string;
  patients: PatientOption[];
  onClose: () => void;
}) {
  const [patientId, setPatientId] = useState("");
  const [appointments, setAppointments] = useState<AppointmentOption[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [appointmentId, setAppointmentId] = useState("");
  const [loadingLink, setLoadingLink] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onPatientChange(pid: string) {
    setPatientId(pid);
    setAppointmentId("");
    setLink(null);
    setError(null);
    if (!pid) {
      setAppointments([]);
      return;
    }
    setLoadingAppointments(true);
    const res = await getAppointmentsByPatient(pid);
    setLoadingAppointments(false);
    if (res.error) {
      setError(res.error);
      setAppointments([]);
      return;
    }
    setAppointments(res.data ?? []);
  }

  async function onGerarLink() {
    if (!appointmentId) return;
    setError(null);
    setLoadingLink(true);
    const res = await ensureFormInstanceAndGetLink(appointmentId, templateId);
    setLoadingLink(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setLink(res.link);
  }

  function copyLink() {
    if (!link) return;
    const fullUrl = typeof window !== "undefined" ? window.location.origin + link : link;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto text-foreground">
        <div className="p-4 border-b border-border flex items-center justify-between bg-card">
          <h2 className="font-semibold text-foreground">Encaminhar: {templateName}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 space-y-4 bg-card text-foreground">
          <p className="text-sm text-muted-foreground">
            Escolha o paciente e a consulta. O link gerado poderá ser enviado ao
            paciente (no futuro, por WhatsApp ou e-mail).
          </p>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label className="text-foreground">Paciente</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={patientId}
              onChange={(e) => onPatientChange(e.target.value)}
            >
              <option value="">Selecione o paciente</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          {loadingAppointments && (
            <p className="text-sm text-muted-foreground">Carregando consultas…</p>
          )}

          {patientId && !loadingAppointments && (
            <div className="space-y-2">
              <Label className="text-foreground">Consulta</Label>
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este paciente não tem consultas agendadas ou confirmadas.
                  Agende uma consulta primeiro na Agenda.
                </p>
              ) : (
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  value={appointmentId}
                  onChange={(e) => {
                    setAppointmentId(e.target.value);
                    setLink(null);
                  }}
                >
                  <option value="">Selecione a consulta</option>
                  {appointments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {new Date(a.scheduled_at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}{" "}
                      {a.doctor_name ? ` · ${a.doctor_name}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {appointmentId && appointments.length > 0 && !link && (
            <Button
              onClick={onGerarLink}
              disabled={loadingLink}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {loadingLink ? "Gerando link…" : "Gerar link do formulário"}
            </Button>
          )}

          {link && (
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-foreground">Link para o paciente</Label>
              <p className="text-sm text-muted-foreground break-all bg-muted/50 p-2 rounded">
                {typeof window !== "undefined"
                  ? window.location.origin + link
                  : link}
              </p>
              <Button onClick={copyLink} variant="outline" className="w-full">
                {copied ? (
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied ? "Copiado!" : "Copiar link"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
