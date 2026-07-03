"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Printer, ArrowLeft, Download } from "lucide-react";
import type { ClinicalDocumentType } from "@/lib/clinical-documents/types";
import { ClinicalDocumentsClient } from "@/app/dashboard/clinical-documents/clinical-documents-client";
import { ClinicalPatientPicker } from "@/components/clinical-patient-picker";
import type { PatientOption } from "@/components/patient-combobox";
import { printClinicalHtml } from "@/components/clinical-layout-picker";
import { getClinicalDocumentHtml, getClinicalDocumentPdfUrl } from "@/app/dashboard/clinical-documents/actions";

const HUB_LABELS: Record<
  ClinicalDocumentType,
  { title: string; subtitle: string; newLabel: string; emptyMessage: string }
> = {
  prescription: {
    title: "Prescrições",
    subtitle: "Receitas médicas emitidas na clínica. Crie avulso ou durante o atendimento.",
    newLabel: "Nova prescrição",
    emptyMessage: "Nenhuma prescrição registrada ainda.",
  },
  exam_request: {
    title: "Pedidos de exame",
    subtitle: "Solicitações de exames emitidas na clínica.",
    newLabel: "Novo pedido de exame",
    emptyMessage: "Nenhum pedido de exame registrado ainda.",
  },
  certificate: {
    title: "Atestados",
    subtitle: "Atestados emitidos na clínica.",
    newLabel: "Novo atestado",
    emptyMessage: "Nenhum atestado registrado ainda.",
  },
};

export type DocumentoHubItem = {
  id: string;
  created_at: string;
  patient_name: string;
  patient_id?: string;
  doctor_name?: string;
  preview?: string;
  appointment_id?: string | null;
  body_rendered?: string | null;
  pdf_path?: string | null;
};

type HubView = "list" | "pick-patient" | "edit";

export function DocumentosHubClient({
  type,
  isDoctor,
  initialItems,
}: {
  type: ClinicalDocumentType;
  isDoctor: boolean;
  initialItems: DocumentoHubItem[];
}) {
  const labels = HUB_LABELS[type];
  const router = useRouter();
  const [view, setView] = useState<HubView>("list");
  const [items, setItems] = useState(initialItems);
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  function refreshList() {
    router.refresh();
    setView("list");
    setPatient(null);
  }

  async function handleReprint(documentId: string, html?: string | null) {
    setPrintError(null);
    if (html) {
      printClinicalHtml(html);
      return;
    }
    const res = await getClinicalDocumentHtml(documentId);
    if (res.error || !res.html) {
      setPrintError(res.error ?? "Não foi possível abrir o documento.");
      return;
    }
    printClinicalHtml(res.html);
  }

  async function handleDownloadPdf(documentId: string) {
    setPrintError(null);
    const res = await getClinicalDocumentPdfUrl(documentId);
    if (res.error || !res.url) {
      setPrintError(res.error ?? "PDF não disponível.");
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  if (view === "pick-patient" && isDoctor) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setView("list")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <h1 className="text-2xl font-semibold">{labels.newLabel}</h1>
        <ClinicalPatientPicker
          value={patient}
          onChange={setPatient}
          onCancel={() => setView("list")}
          onConfirm={() => patient?.id && setView("edit")}
          confirmLabel="Abrir editor"
        />
      </div>
    );
  }

  if (view === "edit" && isDoctor && patient?.id) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={() => setView("pick-patient")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Trocar paciente
          </Button>
          <span>
            Paciente: <strong className="text-foreground">{patient.full_name}</strong>
          </span>
        </div>
        <ClinicalDocumentsClient
          type={type}
          patientId={patient.id}
          appointmentId={null}
          procedureId={null}
          isDoctor={isDoctor}
          mode="standalone"
          onBack={refreshList}
          onFinalized={refreshList}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{labels.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{labels.subtitle}</p>
        </div>
        {isDoctor && (
          <Button onClick={() => setView("pick-patient")}>
            <Plus className="h-4 w-4 mr-1" />
            {labels.newLabel}
          </Button>
        )}
      </div>

      {printError && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{printError}</div>
      )}

      <Card>
        <CardHeader>
          <p className="text-sm font-medium">{items.length} registro(s)</p>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.id} className="py-3 first:pt-0">
              <div className="flex flex-wrap justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {item.patient_id ? (
                    <Link
                      href={`/dashboard/contatos/pacientes/${item.patient_id}`}
                      className="font-medium hover:text-primary"
                    >
                      {item.patient_name}
                    </Link>
                  ) : (
                    <p className="font-medium">{item.patient_name}</p>
                  )}
                  {item.doctor_name && (
                    <p className="text-xs text-muted-foreground">Dr(a). {item.doctor_name}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {!item.appointment_id && (
                      <Badge variant="outline" className="text-xs">
                        Avulso
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  {item.body_rendered && (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleReprint(item.id, item.body_rendered)}
                      >
                        <Printer className="h-4 w-4 mr-1" />
                        Reimprimir
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDownloadPdf(item.id)}
                        title="Baixar PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {item.appointment_id && (
                <Link
                  href={`/dashboard/agenda/atendimento/${item.appointment_id}`}
                  className="text-xs text-primary hover:underline mt-1 inline-block"
                >
                  Ver atendimento
                </Link>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">{labels.emptyMessage}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
