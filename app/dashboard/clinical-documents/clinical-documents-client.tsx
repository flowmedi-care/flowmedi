"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Printer, Save, FileText, ArrowLeft, Eye } from "lucide-react";
import {
  finalizeClinicalDocumentManual,
  getClinicalDocumentHtml,
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
import { emptyStructuredContent, isExamOrderContent } from "@/lib/clinical-documents/render";
import { MedicationPrescriptionEditor } from "./medication-prescription-editor";
import { ExamOrderEditor } from "./exam-order-editor";

const TYPE_LABELS: Record<ClinicalDocumentType, { title: string; newLabel: string }> = {
  prescription: { title: "Receitas", newLabel: "Nova receita" },
  exam_request: { title: "Pedidos de exame", newLabel: "Novo pedido" },
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  issued_manual: { label: "Emitido (manual)", variant: "default" },
  signed_digital: { label: "Assinado digital", variant: "default" },
  pending_signature: { label: "Aguardando assinatura", variant: "outline" },
  void: { label: "Anulado", variant: "outline" },
};

function printHtml(html: string) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) {
    alert("Permita pop-ups para imprimir o documento.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 400);
}

export function ClinicalDocumentsClient({
  type,
  patientId,
  appointmentId,
  isDoctor,
}: {
  type: ClinicalDocumentType;
  patientId: string;
  appointmentId: string;
  isDoctor: boolean;
}) {
  const labels = TYPE_LABELS[type];
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [templates, setTemplates] = useState<ClinicalDocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "edit">("list");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [structured, setStructured] = useState<StructuredContent>(() => emptyStructuredContent(type));
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [docsRes, tplRes] = await Promise.all([
      listClinicalDocuments({ appointmentId, patientId, type }),
      listClinicalTemplates(type),
    ]);
    if (docsRes.error) setError(docsRes.error);
    else setDocuments(docsRes.data);
    if (!tplRes.error) setTemplates(tplRes.data);
    setLoading(false);
  }, [appointmentId, patientId, type]);

  useEffect(() => {
    if (isDoctor) load();
    else setLoading(false);
  }, [isDoctor, load]);

  function startNew(template?: ClinicalDocumentTemplate) {
    setEditingId(undefined);
    setTitle("");
    setBodyText(template?.body ?? "");
    setStructured(emptyStructuredContent(type));
    setView("edit");
    setError(null);
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
    if (
      doc.type === "exam_request" &&
      !isExamOrderContent(sc)
    ) {
      setStructured({ examLines: [], examNotes: "" });
    } else {
      setStructured(sc);
    }
    setView("edit");
    setError(null);
  }

  async function openPrint(documentId: string) {
    const { html, error: err } = await getClinicalDocumentHtml(documentId);
    if (err || !html) {
      setError(err ?? "Não foi possível abrir o documento.");
      return;
    }
    printHtml(html);
  }

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);
    const res = await saveClinicalDocumentDraft({
      id: editingId,
      type,
      patientId,
      appointmentId,
      title: title || null,
      bodyText,
      structuredContent: structured,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data) setEditingId(res.data.id);
    await load();
  }

  function validateBeforeFinalize(): string | null {
    if (type === "prescription" && "medications" in structured) {
      const hasMed = structured.medications.some((m) => m.name.trim());
      if (!hasMed) return "Adicione pelo menos um medicamento.";
    }
    if (type === "exam_request" && isExamOrderContent(structured)) {
      const hasExam = structured.examLines.some((l) => l.name.trim());
      if (!hasExam) return "Adicione pelo menos um exame.";
    }
    return null;
  }

  async function handleFinalizeAndPrint() {
    const validationErr = validateBeforeFinalize();
    if (validationErr) {
      setError(validationErr);
      return;
    }

    setFinalizing(true);
    setError(null);

    let docId = editingId;
    if (!docId) {
      const saveRes = await saveClinicalDocumentDraft({
        type,
        patientId,
        appointmentId,
        title: title || null,
        bodyText,
        structuredContent: structured,
      });
      if (saveRes.error || !saveRes.data) {
        setError(saveRes.error ?? "Erro ao salvar.");
        setFinalizing(false);
        return;
      }
      docId = saveRes.data.id;
      setEditingId(docId);
    } else {
      const saveRes = await saveClinicalDocumentDraft({
        id: docId,
        type,
        patientId,
        appointmentId,
        title: title || null,
        bodyText,
        structuredContent: structured,
      });
      if (saveRes.error) {
        setError(saveRes.error);
        setFinalizing(false);
        return;
      }
    }

    const fin = await finalizeClinicalDocumentManual(docId);
    setFinalizing(false);
    if (fin.error || !fin.html) {
      setError(fin.error ?? "Erro ao finalizar.");
      return;
    }
    printHtml(fin.html);
    setView("list");
    await load();
  }

  if (!isDoctor) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Apenas o médico responsável pode emitir {labels.title.toLowerCase()} nesta consulta.
      </p>
    );
  }

  if (view === "edit") {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setView("list")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>

        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h3 className="font-semibold">{editingId ? "Editar" : labels.newLabel}</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              {templates.length > 0 && !editingId && (
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
                O documento será impresso para assinatura com carimbo e caneta. A assinatura digital
                (certificado ICP) estará disponível quando configurada.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                    {doc.title ||
                      (type === "prescription" ? "Receita" : "Pedido de exame")}{" "}
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
                    <Button size="sm" variant="outline" onClick={() => openPrint(doc.id)}>
                      <Printer className="h-4 w-4" />
                    </Button>
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

