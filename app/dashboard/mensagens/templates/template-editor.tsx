"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MessageEvent } from "../actions";
import {
  createMessageTemplate,
  updateMessageTemplate,
} from "../actions";
import { extractVariables, validateVariables } from "@/lib/message-variables";
import { ArrowLeft, Mail, MessageSquare, AlertCircle } from "lucide-react";

const AVAILABLE_VARIABLES = [
  { category: "Paciente", vars: ["{{nome_paciente}}", "{{email_paciente}}", "{{telefone_paciente}}", "{{data_nascimento}}"] },
  { category: "Consulta", vars: ["{{data_consulta}}", "{{hora_consulta}}", "{{data_hora_consulta}}", "{{nome_medico}}", "{{tipo_consulta}}", "{{nome_procedimento}}", "{{status_consulta}}"] },
  { category: "Preparação", vars: ["{{recomendacoes}}", "{{precisa_jejum}}", "{{instrucoes_especiais}}", "{{notas_preparo}}", "{{preparo_completo}}"] },
  { category: "Formulário", vars: ["{{link_formulario}}", "{{nome_formulario}}", "{{prazo_formulario}}", "{{instrucao_formulario}}"] },
  { category: "Clínica", vars: ["{{nome_clinica}}", "{{telefone_clinica}}", "{{endereco_clinica}}"] },
];

export function TemplateEditor({
  templateId,
  initialEventCode,
  initialChannel,
  initialName,
  initialSubject,
  initialBodyHtml,
  initialBodyText,
  events,
}: {
  templateId: string | null;
  initialEventCode: string;
  initialChannel: "email" | "whatsapp";
  initialName: string;
  initialSubject: string;
  initialBodyHtml: string;
  initialBodyText: string;
  initialEmailHeader?: string;
  initialEmailFooter?: string;
  events: MessageEvent[];
}) {
  const router = useRouter();
  const [eventCode, setEventCode] = useState(initialEventCode);
  const [channel, setChannel] = useState<"email" | "whatsapp">(initialChannel);
  const [name, setName] = useState(initialName);
  const [subject, setSubject] = useState(initialSubject);
  const [bodyHtml, setBodyHtml] = useState(initialBodyHtml);
  const [bodyText, setBodyText] = useState(initialBodyText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!templateId;
  const variablesUsed = extractVariables(bodyHtml + (subject || ""));
  const validation = validateVariables(bodyHtml + (subject || ""));

  function insertVariable(variable: string) {
    const textarea = document.getElementById("body_html") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = bodyHtml;
      const newText = text.substring(0, start) + variable + text.substring(end);
      setBodyHtml(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Nome do template é obrigatório");
      return;
    }

    if (!eventCode) {
      setError("Selecione um evento");
      return;
    }

    if (!bodyHtml.trim()) {
      setError("Corpo da mensagem é obrigatório");
      return;
    }

    if (channel === "email" && !subject.trim()) {
      setError("Assunto é obrigatório para emails");
      return;
    }

    setLoading(true);

    if (isEdit && templateId) {
      const result = await updateMessageTemplate(
        templateId,
        name,
        channel === "email" ? subject : null,
        bodyHtml,
        bodyText || null,
        variablesUsed,
        null,
        null
      );

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
    } else {
      const result = await createMessageTemplate(
        eventCode,
        name,
        channel,
        channel === "email" ? subject : null,
        bodyHtml,
        bodyText || null,
        variablesUsed,
        null,
        null
      );

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
    }

    router.push("/dashboard/mensagens/templates");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/mensagens/templates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {isEdit ? "Editar Template" : "Novo Template"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Crie um template de mensagem para email ou WhatsApp
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Informações Básicas */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Informações Básicas</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Template *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Lembrete Consulta - Jejum"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event_code">Evento *</Label>
                <select
                  id="event_code"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={eventCode}
                  onChange={(e) => setEventCode(e.target.value)}
                  required
                  disabled={isEdit}
                >
                  <option value="">Selecione um evento</option>
                  {events.map((event) => (
                    <option key={event.code} value={event.code}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Canal *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    value="email"
                    checked={channel === "email"}
                    onChange={(e) => setChannel(e.target.value as "email" | "whatsapp")}
                    disabled={isEdit}
                    className="h-4 w-4"
                  />
                  <Mail className="h-4 w-4" />
                  <span>Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    value="whatsapp"
                    checked={channel === "whatsapp"}
                    onChange={(e) => setChannel(e.target.value as "email" | "whatsapp")}
                    disabled={isEdit}
                    className="h-4 w-4"
                  />
                  <MessageSquare className="h-4 w-4" />
                  <span>WhatsApp</span>
                </label>
              </div>
            </div>

            {channel === "email" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="subject">Assunto *</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex.: Sua consulta está agendada"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Cabeçalho e rodapé são definidos no topo da página de templates (valem para todos os emails).
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Editor de Mensagem */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Corpo da Mensagem *</h2>
                <p className="text-sm text-muted-foreground">
                  Use as variáveis disponíveis no painel ao lado
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  id="body_html"
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  placeholder={
                    channel === "email"
                      ? "Digite o conteúdo do email aqui..."
                      : "Digite a mensagem do WhatsApp aqui..."
                  }
                  rows={12}
                  className="font-mono text-sm"
                  required
                />

                {channel === "email" && (
                  <div className="space-y-2">
                    <Label htmlFor="body_text">Versão Texto (Opcional)</Label>
                    <Textarea
                      id="body_text"
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      placeholder="Versão texto simples do email (para clientes que não suportam HTML)"
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>
                )}

                {validation.missing.length > 0 && (
                  <div className="text-sm text-destructive">
                    <strong>Atenção:</strong> Variáveis não reconhecidas:{" "}
                    {validation.missing.join(", ")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Painel de Variáveis */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Variáveis Disponíveis</h3>
                <p className="text-xs text-muted-foreground">
                  Clique para inserir no texto
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {AVAILABLE_VARIABLES.map((group) => (
                  <div key={group.category}>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {group.category}
                    </p>
                    <div className="space-y-1">
                      {group.vars.map((variable) => (
                        <button
                          key={variable}
                          type="button"
                          onClick={() => insertVariable(variable)}
                          className="w-full text-left px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded border border-border transition-colors font-mono"
                        >
                          {variable}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Variáveis Usadas */}
            {variablesUsed.length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="text-sm font-semibold">Variáveis Usadas</h3>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {variablesUsed.map((variable) => (
                      <span
                        key={variable}
                        className="text-xs px-2 py-1 bg-primary/10 text-primary rounded font-mono"
                      >
                        {variable}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Link href="/dashboard/mensagens/templates">
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Template"}
          </Button>
        </div>
      </form>
    </div>
  );
}
