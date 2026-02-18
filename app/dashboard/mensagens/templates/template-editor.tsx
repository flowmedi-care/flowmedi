"use client";

import { useState, useEffect } from "react";
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
import { ArrowLeft, Mail, MessageSquare, AlertCircle, Code2, Palette } from "lucide-react";
import { VisualEditor, blocksToHtml } from "@/components/email-template-builder/visual-editor";
import { EmailBlock } from "@/components/email-template-builder/types";
import { htmlToBlocks } from "@/components/email-template-builder/html-converter";

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
  const [editorMode, setEditorMode] = useState<"visual" | "html">("visual");
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);

  const isEdit = !!templateId;
  const variablesUsed = extractVariables(bodyHtml + (subject || ""));
  const validation = validateVariables(bodyHtml + (subject || ""));

  // Inicializa blocos a partir do HTML existente apenas uma vez
  useEffect(() => {
    if (initialBodyHtml && editorMode === "visual" && blocks.length === 0) {
      try {
        // Tenta converter HTML existente em blocos
        const convertedBlocks = htmlToBlocks(initialBodyHtml);
        if (convertedBlocks.length > 0) {
          setBlocks(convertedBlocks);
          // Atualiza o HTML para garantir sincronização
          const html = blocksToHtml(convertedBlocks);
          setBodyHtml(html);
        }
      } catch (e) {
        // Se falhar, mantém vazio
        console.error("Erro ao converter HTML para blocos:", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza HTML quando blocos mudam
  const handleBlocksChange = (newBlocks: EmailBlock[]) => {
    setBlocks(newBlocks);
    const html = blocksToHtml(newBlocks);
    setBodyHtml(html);
  };

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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Corpo da Mensagem *</h2>
                <p className="text-sm text-muted-foreground">
                  {editorMode === "visual" 
                    ? "Use o editor visual para criar seu template de forma fácil e intuitiva"
                    : "Use o modo HTML para edição avançada"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={editorMode === "visual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (editorMode === "html" && bodyHtml) {
                      // Tenta converter HTML para blocos ao voltar para visual
                      try {
                        const convertedBlocks = htmlToBlocks(bodyHtml);
                        if (convertedBlocks.length > 0) {
                          setBlocks(convertedBlocks);
                        }
                      } catch (e) {
                        console.error("Erro ao converter:", e);
                      }
                    }
                    setEditorMode("visual");
                  }}
                >
                  <Palette className="h-4 w-4 mr-2" />
                  Visual
                </Button>
                <Button
                  type="button"
                  variant={editorMode === "html" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (editorMode === "visual") {
                      // Converte blocos para HTML ao mudar para modo HTML
                      const html = blocksToHtml(blocks);
                      setBodyHtml(html);
                    }
                    setEditorMode("html");
                  }}
                >
                  <Code2 className="h-4 w-4 mr-2" />
                  HTML
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editorMode === "visual" ? (
              <VisualEditor
                initialBlocks={blocks}
                onBlocksChange={handleBlocksChange}
                channel={channel}
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="body_html">HTML da Mensagem *</Label>
                  <Textarea
                    id="body_html"
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    placeholder={
                      channel === "email"
                        ? "Digite o conteúdo HTML do email aqui..."
                        : "Digite a mensagem do WhatsApp aqui..."
                    }
                    rows={12}
                    className="font-mono text-sm mt-2"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Use as variáveis disponíveis no painel ao lado. Exemplo: Olá {"{{"}nome_paciente{"}}"}, sua consulta está agendada para {"{{"}data_consulta{"}}"}.
                  </p>
                </div>

                <div className="flex gap-2">
                  {AVAILABLE_VARIABLES.map((group) => (
                    <div key={group.category} className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
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
                </div>
              </div>
            )}

            {channel === "email" && (
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="body_text">Versão Texto (Opcional)</Label>
                <Textarea
                  id="body_text"
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Versão texto simples do email (para clientes que não suportam HTML)"
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Se não preenchido, será gerado automaticamente a partir do HTML.
                </p>
              </div>
            )}

            {validation.missing.length > 0 && (
              <div className="text-sm text-destructive p-3 bg-destructive/10 rounded border border-destructive/20">
                <strong>Atenção:</strong> Variáveis não reconhecidas:{" "}
                {validation.missing.join(", ")}
              </div>
            )}

            {variablesUsed.length > 0 && (
              <div className="pt-4 border-t">
                <Label className="text-sm font-semibold mb-2 block">Variáveis Usadas</Label>
                <div className="flex flex-wrap gap-2">
                  {variablesUsed.map((variable) => (
                    <span
                      key={variable}
                      className="text-xs px-2 py-1 bg-primary/10 text-primary rounded font-mono"
                    >
                      {variable}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
