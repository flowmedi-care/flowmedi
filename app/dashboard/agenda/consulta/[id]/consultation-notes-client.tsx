"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  createConsultationNote,
  updateConsultationNote,
  deleteConsultationNote,
  getConsultationNotes,
  type ConsultationNote,
} from "./consultation-notes-actions";
import { Edit2, Trash2, Send, X, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConsultationNotesClient({
  appointmentId,
  isDoctor,
}: {
  appointmentId: string;
  isDoctor: boolean;
}) {
  const [notes, setNotes] = useState<ConsultationNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotes();
  }, [appointmentId]);

  async function loadNotes() {
    setLoading(true);
    setError(null);
    const result = await getConsultationNotes(appointmentId);
    if (result.error) {
      setError(result.error);
    } else {
      setNotes(result.data || []);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!content.trim()) {
      setError("Digite algo antes de publicar.");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await createConsultationNote(appointmentId, content);
    if (result.error) {
      setError(result.error);
    } else {
      setContent("");
      setShowCreateForm(false);
      await loadNotes();
    }
    setSaving(false);
  }

  async function handleUpdate(noteId: string) {
    if (!content.trim()) {
      setError("Digite algo antes de salvar.");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await updateConsultationNote(noteId, content);
    if (result.error) {
      setError(result.error);
    } else {
      setContent("");
      setEditingId(null);
      await loadNotes();
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deletingId) return;

    setSaving(true);
    const result = await deleteConsultationNote(deletingId);
    if (result.error) {
      setError(result.error);
    } else {
      setDeletingId(null);
      await loadNotes();
    }
    setSaving(false);
  }

  function startEdit(note: ConsultationNote) {
    setEditingId(note.id);
    setContent(note.content);
    setShowCreateForm(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setContent("");
    setShowCreateForm(false);
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Formulário de criação */}
      {isDoctor && !editingId && (
        <Card>
          <CardContent className="pt-6">
            {!showCreateForm ? (
              <Button
                onClick={() => setShowCreateForm(true)}
                className="w-full"
                variant="outline"
              >
                Escrever sobre esta consulta...
              </Button>
            ) : (
              <div className="space-y-3">
                <Textarea
                  placeholder="O que foi feito nesta consulta? Descreva os procedimentos, diagnósticos, prescrições..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEdit}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreate}
                    disabled={saving || !content.trim()}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Publicar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista de posts */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Carregando posts...
        </p>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum post ainda. {isDoctor && "Seja o primeiro a escrever sobre esta consulta!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="pt-6">
                {editingId === note.id ? (
                  <div className="space-y-3">
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(note.id)}
                        disabled={saving || !content.trim()}
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm">
                            {note.doctor_name || "Médico"}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(note.created_at)}
                            {note.updated_at !== note.created_at && " (editado)"}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      </div>
                      {isDoctor && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(note)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingId(note.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        title="Deletar post"
        message="Tem certeza que deseja deletar este post? Esta ação não pode ser desfeita."
        confirmLabel="Deletar"
        variant="destructive"
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
