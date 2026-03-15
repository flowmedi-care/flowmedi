"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  createClinicMetaMessageModel,
  deleteClinicMetaMessageModel,
  submitClinicMetaMessageModel,
  type MessageEvent,
  type MetaMessageModelDraft,
  type SystemMetaTemplateKey,
} from "../actions";

export function MetaModelsClient({
  initialModels,
  events,
}: {
  initialModels: MetaMessageModelDraft[];
  events: MessageEvent[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [eventCode, setEventCode] = useState("");
  const [templateKey, setTemplateKey] = useState<SystemMetaTemplateKey>("flowmedi_consulta");
  const [bodyText, setBodyText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    setSaving(true);
    const res = await createClinicMetaMessageModel(name, eventCode, templateKey, bodyText);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setName("");
    setEventCode("");
    setTemplateKey("flowmedi_consulta");
    setBodyText("");
    router.refresh();
  }

  async function handleSubmit(id: string) {
    setSubmittingId(id);
    const res = await submitClinicMetaMessageModel(id);
    setSubmittingId(null);
    if (res.error) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja excluir este modelo Meta?")) return;
    setDeletingId(id);
    const res = await deleteClinicMetaMessageModel(id);
    setDeletingId(null);
    if (res.error) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Modelos locais para preparar e enviar para aprovação na Meta.
        </p>
        <Button onClick={() => setOpen(true)}>Novo modelo Meta</Button>
      </div>

      {initialModels.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">Nenhum modelo Meta criado ainda.</Card>
      ) : (
        <div className="space-y-2">
          {initialModels.map((model) => (
            <Card key={model.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{model.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Evento: {events.find((e) => e.code === model.event_code)?.name || model.event_code}
                  </p>
                  <p className="text-xs text-muted-foreground">Modelo: {model.template_key}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={model.status === "submitted" ? "default" : "outline"}>
                    {model.status}
                  </Badge>
                  {model.meta_status && <Badge variant="secondary">Meta: {model.meta_status}</Badge>}
                </div>
              </div>
              <p className="text-sm mt-3 whitespace-pre-wrap">{model.body_text}</p>
              {model.last_error && (
                <p className="text-xs mt-2 text-destructive">{model.last_error}</p>
              )}
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  onClick={() => handleSubmit(model.id)}
                  disabled={model.status === "submitted" || submittingId === model.id}
                >
                  {submittingId === model.id ? "Enviando..." : "Enviar para Meta"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(model.id)}
                  disabled={deletingId === model.id}
                >
                  {deletingId === model.id ? "Excluindo..." : "Excluir"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Novo modelo de mensagem Meta" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Lembrete Pós-consulta Meta" />
            </div>
            <div className="space-y-2">
              <Label>Evento vinculado</Label>
              <select
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione</option>
                {events.map((event) => (
                  <option key={event.id} value={event.code}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de modelo</Label>
              <select
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value as SystemMetaTemplateKey)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="flowmedi_consulta">Consulta</option>
                <option value="flowmedi_formulario">Formulário</option>
                <option value="flowmedi_aviso">Aviso</option>
                <option value="flowmedi_mensagem_livre">Mensagem livre</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Texto da mensagem</Label>
              <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={7} />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? "Salvando..." : "Salvar modelo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
