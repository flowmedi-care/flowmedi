"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Upload,
  FileText,
  Download,
  Trash2,
  X,
  Image as ImageIcon,
  File,
  Calendar,
  User,
} from "lucide-react";
import {
  uploadPatientExam,
  getPatientExams,
  updatePatientExam,
  deletePatientExam,
  getExamSignedUrl,
  type PatientExam,
} from "./actions";
import { cn } from "@/lib/utils";

export function ExamesClient({
  patientId,
  appointmentId,
  canEdit = true,
}: {
  patientId: string;
  appointmentId?: string | null;
  canEdit?: boolean;
}) {
  const [exams, setExams] = useState<PatientExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    exam_type: "",
    description: "",
  });

  useEffect(() => {
    loadExams();
  }, [patientId, appointmentId]);

  async function loadExams() {
    setLoading(true);
    setError(null);
    const result = await getPatientExams(patientId);
    if (result.error) {
      setError(result.error);
    } else {
      setExams(result.data || []);
    }
    setLoading(false);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadForm.file) {
      setError("Selecione um arquivo.");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", uploadForm.file);
    formData.append("patient_id", patientId);
    if (appointmentId) {
      formData.append("appointment_id", appointmentId);
    }
    if (uploadForm.exam_type) {
      formData.append("exam_type", uploadForm.exam_type);
    }
    if (uploadForm.description) {
      formData.append("description", uploadForm.description);
    }

    const result = await uploadPatientExam(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setShowUploadModal(false);
      setUploadForm({ file: null, exam_type: "", description: "" });
      await loadExams();
    }
    setUploading(false);
  }

  async function handleDelete(examId: string) {
    setDeletingId(examId);
    setError(null);
    const result = await deletePatientExam(examId);
    if (result.error) {
      setError(result.error);
    } else {
      await loadExams();
    }
    setDeletingId(null);
    setShowUploadModal(false);
  }

  async function handleDownload(exam: PatientExam) {
    setError(null);
    const result = await getExamSignedUrl(exam.file_url);
    if (result.error) {
      setError(result.error);
    } else if (result.url) {
      window.open(result.url, "_blank");
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function getFileIcon(fileType: string) {
    if (fileType.startsWith("image/")) {
      return <ImageIcon className="h-5 w-5" />;
    }
    if (fileType === "application/pdf") {
      return <FileText className="h-5 w-5" />;
    }
    return <File className="h-5 w-5" />;
  }

  const filteredExams = appointmentId
    ? exams.filter((e) => e.appointment_id === appointmentId)
    : exams;

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Exames</h3>
          <p className="text-sm text-muted-foreground">
            {filteredExams.length} exame(s) encontrado(s)
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowUploadModal(true)} size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Adicionar Exame
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4">Carregando exames...</p>
      ) : filteredExams.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum exame cadastrado para este paciente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredExams.map((exam) => (
            <Card key={exam.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">{getFileIcon(exam.file_type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{exam.file_name}</p>
                        {exam.exam_type && (
                          <Badge variant="outline" className="text-xs">
                            {exam.exam_type}
                          </Badge>
                        )}
                        {exam.appointment_id === appointmentId && (
                          <Badge variant="secondary" className="text-xs">
                            Desta consulta
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(exam.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                        <span>{formatFileSize(exam.file_size)}</span>
                        {exam.uploaded_by_role && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {exam.uploaded_by_role === "secretaria"
                              ? "Secretária"
                              : exam.uploaded_by_role === "admin"
                              ? "Admin"
                              : exam.uploaded_by_role === "patient"
                              ? "Paciente"
                              : "Médico"}
                          </span>
                        )}
                      </div>
                      {exam.description && (
                        <p className="text-sm text-muted-foreground mt-2">{exam.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(exam)}
                      title="Baixar exame"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(exam.id)}
                        disabled={deletingId === exam.id}
                        title="Excluir exame"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <h3 className="font-semibold">Adicionar Exame</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadForm({ file: null, exam_type: "", description: "" });
                  setError(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file">Arquivo *</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadForm((f) => ({ ...f, file }));
                      }
                    }}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: PDF, imagens (JPG, PNG, WEBP), documentos Word. Máximo: 20MB
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exam_type">Tipo de Exame</Label>
                  <Input
                    id="exam_type"
                    type="text"
                    placeholder="Ex: Hemograma, Raio-X, Ultrassom..."
                    value={uploadForm.exam_type}
                    onChange={(e) =>
                      setUploadForm((f) => ({ ...f, exam_type: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição / Observações</Label>
                  <Textarea
                    id="description"
                    placeholder="Observações sobre o exame..."
                    value={uploadForm.description}
                    onChange={(e) =>
                      setUploadForm((f) => ({ ...f, description: e.target.value }))
                    }
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={uploading || !uploadForm.file}>
                    {uploading ? "Enviando..." : "Enviar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadForm({ file: null, exam_type: "", description: "" });
                      setError(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <ConfirmDialog
        open={deletingId !== null}
        title="Excluir Exame"
        message="Tem certeza que deseja excluir este exame? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        loading={deletingId !== null}
        onConfirm={() => {
          if (deletingId) {
            handleDelete(deletingId);
          }
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
