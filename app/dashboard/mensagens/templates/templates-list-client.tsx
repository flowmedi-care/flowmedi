"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, MessageSquare, Edit, Trash2, Copy } from "lucide-react";
import { deactivateMessageTemplate, createMessageTemplateFromSystem, type EffectiveTemplateItem } from "../actions";
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
  effectiveTemplates,
}: {
  effectiveTemplates: EffectiveTemplateItem[];
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [usingSystemId, setUsingSystemId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja desativar este template?")) return;
    setDeleting(id);
    const result = await deactivateMessageTemplate(id);
    setDeleting(null);
    if (result.error) alert(`Erro: ${result.error}`);
    else router.refresh();
  }

  async function handleUseSystem(t: EffectiveTemplateItem) {
    const key = `${t.event_code}:${t.channel}`;
    setUsingSystemId(key);
    const res = await createMessageTemplateFromSystem(t.event_code, t.channel);
    setUsingSystemId(null);
    if (res.error) {
      alert(res.error);
      return;
    }
    if (res.data?.id) router.push(`/dashboard/mensagens/templates/${res.data.id}/editar`);
    else router.refresh();
  }

  if (effectiveTemplates.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground mb-4">
          Nenhum template disponível. Execute a migration dos templates do sistema ou crie um template manualmente.
        </p>
        <Link href="/dashboard/mensagens/templates/novo">
          <Button>Criar Primeiro Template</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {effectiveTemplates.map((t) => (
        <Card key={`${t.event_code}:${t.channel}`} className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="font-medium text-foreground">{t.event_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  {CHANNEL_ICONS[t.channel]}
                  {CHANNEL_LABELS[t.channel]}
                  {t.is_system && <span>· Padrão do sistema</span>}
                </span>
              </div>
            </div>
          </div>

          {t.subject && (
            <p className="text-sm text-muted-foreground mb-2">
              <strong>Assunto:</strong> {t.subject}
            </p>
          )}

          <div className="text-xs text-muted-foreground mb-4 line-clamp-2">
            {t.body_preview}
          </div>

          <div className="flex items-center gap-2">
            {t.is_system ? (
              <Button
                variant="outline"
                size="sm"
                disabled={usingSystemId === `${t.event_code}:${t.channel}`}
                onClick={() => handleUseSystem(t)}
              >
                {usingSystemId === `${t.event_code}:${t.channel}` ? "..." : <Copy className="h-3 w-3 mr-1" />}
                Usar e editar
              </Button>
            ) : (
              <>
                <Link href={`/dashboard/mensagens/templates/${t.id}/editar`}>
                  <Button variant="outline" size="sm">
                    <Edit className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(t.id)}
                  disabled={deleting === t.id}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Desativar
                </Button>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
