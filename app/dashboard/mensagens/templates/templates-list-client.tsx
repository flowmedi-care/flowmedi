"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, MessageSquare, Edit, Trash2, Copy } from "lucide-react";
import { deactivateMessageTemplate, createMessageTemplateFromSystem, type EffectiveTemplateItem, type MessageTemplate } from "../actions";
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
  savedTemplates,
  systemTemplates,
}: {
  savedTemplates: MessageTemplate[];
  systemTemplates: EffectiveTemplateItem[];
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

  return (
    <div className="space-y-8">
      {/* 1. Templates salvos (configurados/editados pelos usuários) */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">Templates salvos</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Os que você configurou ou editou.
        </p>
        {savedTemplates.length === 0 ? (
          <Card className="p-6">
            <p className="text-muted-foreground mb-4">Nenhum template criado ainda.</p>
            <Link href="/dashboard/mensagens/templates/novo">
              <Button>Criar template</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedTemplates.map((t) => (
              <Card key={t.id} className="p-4">
                <h3 className="font-medium text-foreground">{t.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {CHANNEL_ICONS[t.channel]}
                  {CHANNEL_LABELS[t.channel]} · {t.event_code}
                </div>
                {t.subject && (
                  <p className="text-sm text-muted-foreground mt-2">
                    <strong>Assunto:</strong> {t.subject}
                  </p>
                )}
                <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {(t.body_html || "").replace(/<[^>]*>/g, "").slice(0, 100)}…
                </div>
                <div className="flex gap-2 mt-4">
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
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 2. Templates do sistema */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">Templates do sistema</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Padrão por evento (Email e WhatsApp separados). Use “Usar e editar” para copiar e personalizar.
        </p>
        {systemTemplates.length === 0 ? (
          <Card className="p-6">
            <p className="text-muted-foreground">
              Nenhum template do sistema disponível. Execute a migration dos templates do sistema.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {systemTemplates.map((t) => (
              <Card key={`${t.event_code}:${t.channel}`} className="p-4 bg-muted/20">
                <h3 className="font-medium text-foreground">{t.event_name}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {CHANNEL_ICONS[t.channel]}
                  {CHANNEL_LABELS[t.channel]}
                </div>
                {t.subject && (
                  <p className="text-sm text-muted-foreground mt-2">
                    <strong>Assunto:</strong> {t.subject}
                  </p>
                )}
                <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {t.body_preview}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  disabled={usingSystemId === `${t.event_code}:${t.channel}`}
                  onClick={() => handleUseSystem(t)}
                >
                  {usingSystemId === `${t.event_code}:${t.channel}` ? "..." : <Copy className="h-3 w-3 mr-1" />}
                  Usar e editar
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
