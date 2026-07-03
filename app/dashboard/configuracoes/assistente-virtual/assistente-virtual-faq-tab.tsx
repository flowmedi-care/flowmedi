"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FaqSections } from "@/components/ui/faq-sections";
import { toast } from "@/components/ui/toast";
import type { VirtualAssistantFaq } from "@/lib/virtual-assistant/types";
import { deleteVirtualAssistantFaq, upsertVirtualAssistantFaq } from "./actions";

interface Props {
  initialFaq: VirtualAssistantFaq[];
}

type FaqFormState = {
  id: string | null;
  question: string;
  answer: string;
};

const EMPTY_FORM: FaqFormState = { id: null, question: "", answer: "" };

export function AssistenteVirtualFaqTab({ initialFaq }: Props) {
  const [faq, setFaq] = useState(initialFaq);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FaqFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: VirtualAssistantFaq) {
    setForm({ id: item.id, question: item.question, answer: item.answer });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    const question = form.question.trim();
    const answer = form.answer.trim();
    if (!question) {
      toast("Informe a pergunta.", "error");
      return;
    }
    if (!answer) {
      toast("Informe a resposta.", "error");
      return;
    }

    setSaving(true);
    const displayOrder = form.id
      ? (faq.find((f) => f.id === form.id)?.display_order ?? faq.length)
      : faq.length;

    const result = await upsertVirtualAssistantFaq(form.id, question, answer, displayOrder);
    setSaving(false);

    if (result.error) {
      toast(result.error, "error");
      return;
    }

    if (result.item) {
      setFaq((prev) => {
        const exists = prev.some((f) => f.id === result.item!.id);
        if (exists) {
          return prev.map((f) => (f.id === result.item!.id ? result.item! : f));
        }
        return [...prev, result.item!].sort((a, b) => a.display_order - b.display_order);
      });
    }

    toast(form.id ? "FAQ atualizada." : "FAQ adicionada.", "success");
    closeDialog();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esta pergunta frequente?")) return;

    setDeletingId(id);
    const result = await deleteVirtualAssistantFaq(id);
    setDeletingId(null);

    if (result.error) {
      toast(result.error, "error");
      return;
    }

    setFaq((prev) => prev.filter((f) => f.id !== id));
    toast("FAQ removida.", "success");
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Perguntas frequentes</CardTitle>
              <CardDescription className="mt-1 max-w-xl">
                O assistente usa estas respostas no WhatsApp. Pré-visualize abaixo como o paciente
                verá cada pergunta.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Adicionar FAQ
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-primary">
              Pré-visualização
            </p>
            <FaqSections
              items={faq}
              variant="cards"
              defaultOpenIndex={faq.length > 0 ? 0 : null}
            />
          </div>

          {faq.length > 0 && (
            <div className="border-t pt-6">
              <p className="mb-3 text-sm font-medium text-foreground">Gerenciar ({faq.length})</p>
              <ul className="space-y-2">
                {faq.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.question}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.answer}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        aria-label={`Editar FAQ ${index + 1}`}
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        aria-label={`Remover FAQ ${index + 1}`}
                        disabled={deletingId === item.id}
                        onClick={() => void handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent
          title={form.id ? "Editar FAQ" : "Nova FAQ"}
          onClose={closeDialog}
          className="max-w-lg"
        >
          <div className="space-y-4 overflow-y-auto p-6 pt-0">
            <div>
              <Label htmlFor="faq-question">Pergunta</Label>
              <Input
                id="faq-question"
                value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                placeholder="Ex.: Vocês aceitam convênio?"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="faq-answer">Resposta</Label>
              <Textarea
                id="faq-answer"
                value={form.answer}
                onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                placeholder="Resposta que o assistente deve usar..."
                rows={5}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Salvando…" : form.id ? "Salvar alterações" : "Adicionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
