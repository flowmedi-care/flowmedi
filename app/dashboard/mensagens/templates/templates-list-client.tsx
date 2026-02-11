"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageTemplate, MessageEvent } from "../actions";
import { Mail, MessageSquare, Edit, Trash2 } from "lucide-react";
import { deactivateMessageTemplate } from "../actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  whatsapp: <MessageSquare className="h-4 w-4" />,
};

export function TemplatesListClient({
  templates,
  events,
}: {
  templates: MessageTemplate[];
  events: MessageEvent[];
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const eventMap = new Map(events.map((e) => [e.code, e.name]));

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja desativar este template?")) return;

    setDeleting(id);
    const result = await deactivateMessageTemplate(id);
    setDeleting(null);

    if (result.error) {
      alert(`Erro: ${result.error}`);
    } else {
      router.refresh();
    }
  }

  if (templates.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground mb-4">
          Nenhum template criado ainda.
        </p>
        <Link href="/dashboard/mensagens/templates/novo">
          <Button>Criar Primeiro Template</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <Card key={template.id} className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="font-medium text-foreground">{template.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {CHANNEL_ICONS[template.channel]}
                  <span className="ml-1">{CHANNEL_LABELS[template.channel]}</span>
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {eventMap.get(template.event_code) || template.event_code}
                </span>
              </div>
            </div>
          </div>

          {template.subject && (
            <p className="text-sm text-muted-foreground mb-2">
              <strong>Assunto:</strong> {template.subject}
            </p>
          )}

          <div className="text-xs text-muted-foreground mb-4 line-clamp-2">
            {template.body_html?.replace(/<[^>]*>/g, "").substring(0, 100)}...
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/dashboard/mensagens/templates/${template.id}/editar`}>
              <Button variant="outline" size="sm">
                <Edit className="h-3 w-3 mr-1" />
                Editar
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(template.id)}
              disabled={deleting === template.id}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Desativar
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
