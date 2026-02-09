"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FileText, Plus, Pencil, Send } from "lucide-react";
import { EncaminharModal } from "./encaminhar-modal";

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
  const [encaminharTemplate, setEncaminharTemplate] = useState<{
    id: string;
    name: string;
  } | null>(null);

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
    </>
  );
}
