"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Pencil, Send, Trash2, Link2, ExternalLink } from "lucide-react";
import { EncaminharModal } from "@/app/dashboard/formularios/encaminhar-modal";
import { deleteFormTemplate, createOrGetPublicFormLink } from "@/app/dashboard/formularios/actions";
import type {
  FormTemplateRow,
  FormTemplatePatientOption,
} from "@/components/forms/form-template-types";

export type { FormTemplateRow, FormTemplatePatientOption };

type FormTemplatesGridProps = {
  templates: FormTemplateRow[];
  patients: FormTemplatePatientOption[];
  /** Base path without trailing slash, e.g. /dashboard/crm/captacao */
  editBasePath: string;
};

export function FormTemplatesGrid({
  templates,
  patients,
  editBasePath,
}: FormTemplatesGridProps) {
  const router = useRouter();
  const [encaminharTemplate, setEncaminharTemplate] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [publicLinkModal, setPublicLinkModal] = useState<{
    templateId: string;
    templateName: string;
    link: string | null;
    loading: boolean;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState<{ id: string; name: string } | null>(null);

  async function handleConfirmExcluirTemplate() {
    if (!confirmExcluir) return;
    setDeletingId(confirmExcluir.id);
    const res = await deleteFormTemplate(confirmExcluir.id);
    setDeletingId(null);
    if (!res.error) {
      setConfirmExcluir(null);
      router.refresh();
    }
  }

  async function handleGeneratePublicLink(templateId: string, templateName: string) {
    setPublicLinkModal({ templateId, templateName, link: null, loading: true });
    const res = await createOrGetPublicFormLink(templateId);
    setPublicLinkModal({
      templateId,
      templateName,
      link: res.link,
      loading: false,
    });
  }

  function copyPublicLink() {
    if (!publicLinkModal?.link) return;
    const fullUrl =
      typeof window !== "undefined"
        ? window.location.origin + publicLinkModal.link
        : publicLinkModal.link;
    navigator.clipboard.writeText(fullUrl);
  }

  if (!templates.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhum formulário. Crie o primeiro para captar leads ou usar na agenda.
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.id} className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight truncate">{t.name}</p>
                  {t.appointment_type_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">{t.appointment_type_name}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {t.is_public && <Badge variant="secondary">Público</Badge>}
              </div>
            </CardHeader>
            <CardContent className="mt-auto space-y-3 pt-0">
              {t.is_public && t.publicUrl && (
                <p className="text-xs text-muted-foreground font-mono truncate" title={t.publicUrl}>
                  {t.publicUrl}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {t.is_public && t.publicUrl && (
                  <a href={t.publicUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="h-8">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      Abrir
                    </Button>
                  </a>
                )}
                {t.is_public && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => handleGeneratePublicLink(t.id, t.name)}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1" />
                    Link
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setEncaminharTemplate({ id: t.id, name: t.name })}
                >
                  <Send className="h-3.5 w-3.5 mr-1" />
                  Encaminhar
                </Button>
                <Link href={`${editBasePath}/${t.id}/editar`}>
                  <Button variant="outline" size="sm" className="h-8">
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-destructive hover:text-destructive"
                  onClick={() => setConfirmExcluir({ id: t.id, name: t.name })}
                  disabled={deletingId === t.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {encaminharTemplate && (
        <EncaminharModal
          templateId={encaminharTemplate.id}
          templateName={encaminharTemplate.name}
          patients={patients}
          onClose={() => setEncaminharTemplate(null)}
        />
      )}

      {publicLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setPublicLinkModal(null)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="font-semibold">Link público</h2>
              <Button variant="ghost" size="sm" onClick={() => setPublicLinkModal(null)}>
                ×
              </Button>
            </div>
            <div className="space-y-4 p-4">
              {publicLinkModal.loading ? (
                <p className="text-sm text-muted-foreground">Gerando link...</p>
              ) : publicLinkModal.link ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Compartilhe este link publicamente (ex: Instagram, site):
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={
                        typeof window !== "undefined"
                          ? window.location.origin + publicLinkModal.link
                          : publicLinkModal.link
                      }
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button onClick={copyPublicLink} size="sm">
                      Copiar
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-destructive">
                  Erro ao gerar link. Verifique se o formulário permite uso público.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir formulário"
        message={
          confirmExcluir
            ? `Tem certeza que deseja excluir o formulário "${confirmExcluir.name}"?`
            : ""
        }
        confirmLabel="Excluir"
        variant="destructive"
        loading={deletingId !== null}
        onConfirm={handleConfirmExcluirTemplate}
        onCancel={() => setConfirmExcluir(null)}
      />
    </>
  );
}
