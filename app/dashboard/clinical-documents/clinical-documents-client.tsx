"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Printer, Save, FileText, ArrowLeft, Eye, Download } from "lucide-react";
import {
  checkClinicalDocumentsSchema,
  finalizeClinicalDocumentManual,
  getClinicalDocumentHtml,
  getClinicalDocumentPdfUrl,
  listClinicalDocuments,
  listClinicalTemplates,
  saveClinicalDocumentDraft,
} from "./actions";
import type {
  ClinicalDocument,
  ClinicalDocumentTemplate,
  ClinicalDocumentType,
  StructuredContent,
} from "@/lib/clinical-documents/types";
import {
  emptyStructuredContent,
  isCertificateContent,
  isExamOrderContent,
} from "@/lib/clinical-documents/render";
import { validateClinicalDocumentContent } from "@/lib/clinical-documents/validate";
import { MedicationPrescriptionEditor } from "./medication-prescription-editor";
import { ExamOrderEditor } from "./exam-order-editor";
import { CertificateOrderEditor } from "./certificate-order-editor";
import { ClinicalDocumentPreview } from "./clinical-document-preview";
import {
  ClinicalLayoutPickerDialog,
  printClinicalHtml,
} from "@/components/clinical-layout-picker";
import type { ClinicalPdfLayoutId } from "@/lib/clinical-documents/pdf-layouts";
import { toast } from "@/components/ui/toast";

const TYPE_LABELS: Record<ClinicalDocumentType, { title: string; newLabel: string }> = {
  prescription: { title: "Receitas", newLabel: "Nova receita" },
  exam_request: { title: "Pedidos de exame", newLabel: "Novo pedido" },
  certificate: { title: "Atestados", newLabel: "Novo atestado" },
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  issued_manual: { label: "Emitido (manual)", variant: "default" },
  signed_digital: { label: "Assinado digital", variant: "default" },
  pending_signature: { label: "Aguardando assinatura", variant: "outline" },
  void: { label: "Anulado", variant: "outline" },
};

function docTypeLabel(type: ClinicalDocumentType) {
  if (type === "prescription") return "Receita";
  if (type === "certificate") return "Atestado";
  return "Pedido de exame";
}

export function ClinicalDocumentsClient({
  type,
  patientId,
  appointmentId,
  procedureId,
  isDoctor,
  mode = "appointment",
  onBack,
  onFinalized,
}: {
  type: ClinicalDocumentType;
  patientId: string;
  appointmentId?: string | null;
  procedureId?: string | null;
  isDoctor: boolean;
  mode?: "appointment" | "standalone";
  onBack?: () => void;
  onFinalized?: () => void;
}) {
  const labels = TYPE_LABELS[type];
  const isStandalone = mode === "standalone";
  const resolvedAppointmentId = appointmentId ?? null;
  const resolvedProcedureId = isStandalone ? null : (procedureId ?? null);

  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [templates, setTemplates] = useState<ClinicalDocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "edit">(isStandalone ? "edit" : "list");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [structured, setStructured] = useState<StructuredContent>(() => emptyStructuredContent(type));
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);
  const [lastFinalizedId, setLastFinalizedId] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const needsLayoutPicker = type === "exam_request" || type === "certificate";

  const load = useCallback(async () => {
    setLoading(true);
    const listInput = isStandalone
      ? { patientId, type, standaloneOnly: true as const }
      : {
          appointmentId: resolvedAppointmentId ?? undefined,
          patientId,
          type,
          procedureId: resolvedProcedureId,
        };

    const [docsRes, tplRes] = await Promise.all([
      listClinicalDocuments(listInput),
      type === "certificate"
        ? Promise.resolve({ data: [] as ClinicalDocumentTemplate[], error: null })
        : listClinicalTemplates(type),
    ]);
    if (docsRes.error) setError(docsRes.error);
    else setDocuments(docsRes.data);
    if (!tplRes.error) setTemplates(tplRes.data);
    setLoading(false);
  }, [isStandalone, patientId, resolvedAppointmentId, type, resolvedProcedureId]);

  useEffect(() => {
    if (!isDoctor) {
      setLoading(false);
      return;
    }
    void checkClinicalDocumentsSchema().then((r) => {
      if (!r.ok) setSchemaWarning(r.message);
    });
    if (!isStandalone) load();
    else setLoading(false);
  }, [isDoctor, isStandalone, load]);

  function handleBack() {
    if (onBack) onBack();
    else setView("list");
  }

  function startNew(template?: ClinicalDocumentTemplate) {
    setEditingId(undefined);
    setTitle("");
    setBodyText(template?.body ?? "");
    setStructured(emptyStructuredContent(type));
    setView("edit");
    setError(null);
    setLastFinalizedId(null);
  }

  function startEdit(doc: ClinicalDocument) {
    if (doc.status !== "draft") {
      void openPrint(doc.id);
      return;
    }
    setEditingId(doc.id);
    setTitle(doc.title ?? "");
    setBodyText(doc.body_text);
    const sc = doc.structured_content;
    if (doc.type === "exam_request" && !isExamOrderContent(sc)) {
      setStructured({ examLines: [], examNotes: "" });
    } else if (doc.type === "certificate" && !isCertificateContent(sc)) {
      setStructured({ certificateBody: "", certificateDays: 1, certificateCid: "" });
    } else {
      setStructured(sc);
    }
    setView("edit");
    setError(null);
  }

  async function openPrint(documentId: string) {
    const { html, error: err } = await getClinicalDocumentHtml(documentId);
    if (err || !html) {
      const msg = err ?? "Não foi possível abrir o documento.";
      setError(msg);
      toast(msg, "error");
      return;
    }
    printClinicalHtml(html);
  }

  async function downloadPdf(documentId: string) {
    const res = await getClinicalDocumentPdfUrl(documentId);
    if (res.error || !res.url) {
      const msg = res.error ?? "PDF não disponível.";
      setError(msg);
      toast(msg, "error");
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);
    const res = await saveClinicalDocumentDraft({
      id: editingId,
      type,
      patientId,
      appointmentId: resolvedAppointmentId,
      procedureId: resolvedProcedureId,
      title: title || null,
      bodyText,
      structuredContent: structured,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      toast(res.error, "error");
      return;
    }
    if (res.data) setEditingId(res.data.id);
    toast("Rascunho salvo.", "success");
    if (!isStandalone) await load();
  }

  function validateBeforeFinalize(): string | null {
    return validateClinicalDocumentContent(type, structured);
  }

  async function prepareDraftForFinalize(): Promise<string | null> {
    const validationErr = validateBeforeFinalize();
    if (validationErr) {
      setError(validationErr);
      toast(validationErr, "error");
      return null;
    }

    let docId = editingId;
    if (!docId) {
      const saveRes = await saveClinicalDocumentDraft({
        type,
        patientId,
        appointmentId: resolvedAppointmentId,
        procedureId: resolvedProcedureId,
        title: title || null,
        bodyText,
        structuredContent: structured,
      });
      if (saveRes.error || !saveRes.data) {
        const msg = saveRes.error ?? "Erro ao salvar.";
        setError(msg);
        toast(msg, "error");
        return null;
      }
      docId = saveRes.data.id;
      setEditingId(docId);
    } else {
      const saveRes = await saveClinicalDocumentDraft({
        id: docId,
        type,
        patientId,
        appointmentId: resolvedAppointmentId,
        procedureId: resolvedProcedureId,
        title: title || null,
        bodyText,
        structuredContent: structured,
      });
      if (saveRes.error) {
        setError(saveRes.error);
        toast(saveRes.error, "error");
        return null;
      }
    }
    return docId;
  }

  async function completeFinalize(docId: string, fin: { html: string | null; error: string | null }) {
    if (fin.error || !fin.html) {
      const msg = fin.error ?? "Erro ao finalizar.";
      setError(msg);
      toast(msg, "error");
      return;
    }
    setLastFinalizedId(docId);
    const printed = printClinicalHtml(fin.html);
    if (!printed) {
      toast("Documento finalizado. Use Baixar PDF ou Imprimir abaixo.", "success");
    } else {
      toast("Documento finalizado.", "success");
    }
    if (isStandalone && onFinalized) {
      onFinalized();
      return;
    }
    setView("list");
    await load();
  }

  async function handleFinalizeAndPrint() {
    setFinalizing(true);
    setError(null);
    const docId = await prepareDraftForFinalize();
    setFinalizing(false);
    if (!docId) return;

    if (needsLayoutPicker) {
      setPendingDocId(docId);
      setLayoutPickerOpen(true);
      return;
    }

    setFinalizing(true);
    const fin = await finalizeClinicalDocumentManual(docId);
    setFinalizing(false);
    await completeFinalize(docId, fin);
  }

  async function handleLayoutSelected(layoutId: ClinicalPdfLayoutId) {
    setLayoutPickerOpen(false);
    if (!pendingDocId) return;

    setFinalizing(true);
    const fin = await finalizeClinicalDocumentManual(pendingDocId, layoutId);
    setFinalizing(false);
    const docId = pendingDocId;
    setPendingDocId(null);
    await completeFinalize(docId, fin);
  }

  if (!isDoctor) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Apenas o médico responsável pode emitir {labels.title.toLowerCase()}
        {isStandalone ? "." : " nesta consulta."}
      </p>
    );
  }

  const schemaBanner = schemaWarning ? (
    <div className="p-3 rounded-md bg-amber-500/10 text-amber-900 dark:text-amber-200 text-sm border border-amber-500/30">
      <p className="font-medium">Configuração do banco incompleta</p>
      <p className="mt-1">{schemaWarning}</p>
    </div>
  ) : null;

  if (view === "edit") {
    return (
      <div className="space-y-4">
        <ClinicalLayoutPickerDialog
          open={layoutPickerOpen}
          onClose={() => {
            setLayoutPickerOpen(false);
            setPendingDocId(null);
          }}
          onSelect={handleLayoutSelected}
        />

        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>

        {schemaBanner}
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {lastFinalizedId && (
          <div className="flex flex-wrap gap-2 p-3 rounded-md bg-primary/5 border border-primary/20">
            <span className="text-sm w-full">Documento emitido com sucesso.</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void openPrint(lastFinalizedId)}
            >
              <Printer className="h-4 w-4 mr-1" />
              Imprimir HTML
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void downloadPdf(lastFinalizedId)}
            >
              <Download className="h-4 w-4 mr-1" />
              Baixar PDF
            </Button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h3 className="font-semibold">{editingId ? "Editar" : labels.newLabel}</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              {templates.length > 0 && !editingId && type !== "certificate" && (
                <div>
                  <Label className="text-sm">Usar template</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {templates.map((t) => (
                      <Button
                        key={t.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => startNew(t)}
                      >
                        {t.name}
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {t.scope === "clinic" ? "Clínica" : "Meu"}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {type === "prescription" && "medications" in structured && (
                <MedicationPrescriptionEditor
                  medications={structured.medications}
                  onChange={(medications) => setStructured({ medications })}
                />
              )}

              {type === "exam_request" && isExamOrderContent(structured) && (
                <ExamOrderEditor
                  examLines={structured.examLines}
                  examNotes={structured.examNotes ?? ""}
                  onLinesChange={(examLines) =>
                    setStructured({ examLines, examNotes: structured.examNotes })
                  }
                  onNotesChange={(examNotes) =>
                    setStructured({ examLines: structured.examLines, examNotes })
                  }
                />
              )}

              {type === "certificate" && isCertificateContent(structured) && (
                <CertificateOrderEditor content={structured} onChange={setStructured} />
              )}

              {type === "prescription" && (
                <div>
                  <Label htmlFor="doc-body">Observações adicionais (opcional)</Label>
                  <Textarea
                    id="doc-body"
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    rows={3}
                    placeholder="Orientações gerais ao paciente..."
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? "Salvando..." : "Salvar rascunho"}
                </Button>
                <Button type="button" onClick={handleFinalizeAndPrint} disabled={finalizing}>
                  <Printer className="h-4 w-4 mr-1" />
                  {finalizing ? "Finalizando..." : "Finalizar e imprimir"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O documento será gerado para impressão e assinatura manual. Um PDF também será
                armazenado para download.
              </p>
            </CardContent>
          </Card>

          <ClinicalDocumentPreview
            type={type}
            patientId={patientId}
            appointmentId={resolvedAppointmentId}
            bodyText={bodyText}
            structuredContent={structured}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ClinicalLayoutPickerDialog
        open={layoutPickerOpen}
        onClose={() => {
          setLayoutPickerOpen(false);
          setPendingDocId(null);
        }}
        onSelect={handleLayoutSelected}
      />

      {schemaBanner}

      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-lg">{labels.title}</h3>
        <Button size="sm" onClick={() => startNew()}>
          <Plus className="h-4 w-4 mr-1" />
          {labels.newLabel}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          Nenhum documento nesta consulta. Clique em &quot;{labels.newLabel}&quot; para começar.
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => {
            const st = STATUS_LABELS[doc.status] ?? STATUS_LABELS.draft;
            return (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-2 p-3 border rounded-lg bg-card"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {doc.title || docTypeLabel(type)}{" "}
                    <span className="text-muted-foreground font-normal text-sm">
                      {new Date(doc.created_at).toLocaleString("pt-BR")}
                    </span>
                  </p>
                  <Badge variant={st.variant} className="mt-1">
                    {st.label}
                  </Badge>
                </div>
                <div className="flex gap-1 shrink-0">
                  {doc.status === "draft" ? (
                    <Button size="sm" variant="outline" onClick={() => startEdit(doc)}>
                      <FileText className="h-4 w-4" />
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openPrint(doc.id)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                      {doc.pdf_path && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void downloadPdf(doc.id)}
                          title="Baixar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                  {doc.body_rendered && doc.status !== "draft" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openPrint(doc.id)}
                      title="Visualizar"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <iframe ref={iframeRef} className="hidden" title="print" />
    </div>
  );
}
