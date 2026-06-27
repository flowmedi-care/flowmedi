"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { copyFichaResponsesFromAppointment } from "../clinical-ficha-actions";
import type { FichaCopySource } from "@/lib/clinical-ficha-types";
import { toast } from "@/components/ui/toast";
import { Loader2 } from "lucide-react";

function formatConsultaLabel(source: FichaCopySource): string {
  const date = new Date(source.scheduled_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return source.doctor_name ? `${date} · ${source.doctor_name}` : date;
}

export function CopyFichasDialog({
  open,
  onOpenChange,
  targetAppointmentId,
  copySources,
  preselectedTemplateId,
  onCopied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetAppointmentId: string;
  copySources: FichaCopySource[];
  preselectedTemplateId?: string | null;
  onCopied: () => void;
}) {
  const [sourceId, setSourceId] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [overwrite, setOverwrite] = useState(false);
  const [copying, setCopying] = useState(false);

  const selectedSource = copySources.find((s) => s.appointment_id === sourceId);

  useEffect(() => {
    if (!open) return;
    const defaultSource = copySources[0]?.appointment_id ?? "";
    setSourceId(defaultSource);
    setOverwrite(false);
  }, [open, copySources]);

  useEffect(() => {
    if (!open || !selectedSource) {
      setSelectedTemplateIds(new Set());
      return;
    }
    if (preselectedTemplateId) {
      const exists = selectedSource.fichas.some(
        (f) => f.ficha_template_id === preselectedTemplateId
      );
      setSelectedTemplateIds(
        exists ? new Set([preselectedTemplateId]) : new Set(selectedSource.fichas.map((f) => f.ficha_template_id))
      );
    } else {
      setSelectedTemplateIds(new Set(selectedSource.fichas.map((f) => f.ficha_template_id)));
    }
  }, [open, selectedSource, preselectedTemplateId]);

  function toggleTemplate(templateId: string) {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  }

  async function handleCopy() {
    if (!sourceId || selectedTemplateIds.size === 0) {
      toast("Selecione ao menos uma ficha para copiar.", "error");
      return;
    }
    setCopying(true);
    const res = await copyFichaResponsesFromAppointment({
      sourceAppointmentId: sourceId,
      targetAppointmentId,
      fichaTemplateIds: [...selectedTemplateIds],
      overwrite,
    });
    setCopying(false);

    if (res.error) {
      toast(res.error, "error");
      return;
    }

    const { copied = 0, skipped = 0 } = res.result ?? {};
    if (copied > 0) {
      const msg =
        skipped > 0
          ? `${copied} ficha(s) copiada(s). ${skipped} ignorada(s).`
          : `${copied} ficha(s) copiada(s) com sucesso.`;
      toast(msg, "success");
      onCopied();
      onOpenChange(false);
    } else {
      toast(
        skipped > 0
          ? "Nenhuma ficha foi copiada. Verifique se já possuem conteúdo."
          : "Nenhuma ficha foi copiada.",
        "error"
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Trazer da consulta anterior"
        onClose={() => onOpenChange(false)}
        className="max-w-md"
      >
        {copySources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Não há consultas anteriores com fichas preenchidas para este paciente.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="copy-source">Consulta de origem</Label>
              <Select
                id="copy-source"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
              >
                {copySources.map((s) => (
                  <option key={s.appointment_id} value={s.appointment_id}>
                    {formatConsultaLabel(s)}
                  </option>
                ))}
              </Select>
            </div>

            {selectedSource && (
              <div className="space-y-2">
                <Label>Fichas a copiar</Label>
                <ul className="space-y-2 rounded-lg border border-border/60 p-3">
                  {selectedSource.fichas.map((f) => (
                    <li key={f.ficha_template_id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`copy-${f.ficha_template_id}`}
                        checked={selectedTemplateIds.has(f.ficha_template_id)}
                        onChange={() => toggleTemplate(f.ficha_template_id)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <label
                        htmlFor={`copy-${f.ficha_template_id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {f.template_name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="copy-overwrite"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="copy-overwrite" className="text-sm text-muted-foreground cursor-pointer">
                Substituir fichas que já possuem conteúdo
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={copying}>
                Cancelar
              </Button>
              <Button onClick={handleCopy} disabled={copying || selectedTemplateIds.size === 0}>
                {copying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Copiando…
                  </>
                ) : (
                  "Copiar fichas"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
