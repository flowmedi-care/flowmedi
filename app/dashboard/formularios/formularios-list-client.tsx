"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { FileText, Pencil, Send, Trash2, Link2 } from "lucide-react";
import { EncaminharModal } from "./encaminhar-modal";
import { deleteFormTemplate, createOrGetPublicFormLink } from "./actions";

type TemplateRow = {
  id: string;
  name: string;
  appointment_type_name: string | null;
  is_public: boolean;
};

type PatientOption = { id: string; full_name: string };

export function FormulariosListClient({
  templates,
  patients,
}: {
  templates: TemplateRow[];
  patients: PatientOption[];
}) {
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

  function openExcluirConfirm(id: string, name: string) {
    setConfirmExcluir({ id, name });
  }

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
    setPublicLinkModal({
      templateId,
      templateName,
      link: null,
      loading: true,
    });
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
    navigator.clipboard.writeText(fullUrl).then(() => {
      // Feedback visual pode ser adicionado aqui
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            Templates de formulário. Vincule a um tipo de consulta para que
            sejam aplicados automaticamente ao agendar. Use &quot;Encaminhar&quot; para
            gerar o link e enviar ao paciente.
          </p>
        </CardHeader>
        <CardContent>
          {!templates.length ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhum formulário. Crie um para usar na agenda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <FileText className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium truncate">{t.name}</span>
                        {t.is_public && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Público
                          </span>
                        )}
                      </div>
                      {t.appointment_type_name && (
                        <span className="text-sm text-muted-foreground">
                          {t.appointment_type_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 p-1 shrink-0">
                    {t.is_public && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 sm:h-9 sm:w-9"
                        onClick={() => handleGeneratePublicLink(t.id, t.name)}
                        title="Gerar link público"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9"
                      onClick={() =>
                        setEncaminharTemplate({ id: t.id, name: t.name })
                      }
                      title="Encaminhar formulário ao paciente"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Link href={`/dashboard/formularios/${t.id}/editar`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:text-destructive"
                      onClick={() => openExcluirConfirm(t.id, t.name)}
                      disabled={deletingId === t.id}
                      title="Excluir formulário"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
          <div className="relative bg-background border border-border rounded-lg shadow-xl max-w-md w-full z-10">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold">Link público</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPublicLinkModal(null)}
              >
                ×
              </Button>
            </div>
            <div className="p-4 space-y-4">
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
