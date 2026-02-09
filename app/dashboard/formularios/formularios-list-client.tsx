"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FileText, Pencil, Send, Trash2 } from "lucide-react";
import { EncaminharModal } from "./encaminhar-modal";
import { deleteFormTemplate } from "./actions";

type TemplateRow = {
  id: string;
  name: string;
  appointment_type_name: string | null;
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
                  className="flex items-center justify-between py-3 first:pt-0"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{t.name}</span>
                    {t.appointment_type_name && (
                      <span className="text-sm text-muted-foreground">
                        → {t.appointment_type_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEncaminharTemplate({ id: t.id, name: t.name })
                      }
                      title="Encaminhar formulário ao paciente"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Link href={`/dashboard/formularios/${t.id}/editar`}>
                      <Button variant="ghost" size="sm" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openExcluirConfirm(t.id, t.name)}
                      disabled={deletingId === t.id}
                      title="Excluir formulário"
                      className="text-destructive hover:text-destructive"
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
