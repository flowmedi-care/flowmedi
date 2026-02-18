"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Mail, Palette, Image as ImageIcon } from "lucide-react";
import { VisualEditor, blocksToHtml } from "@/components/email-template-builder/visual-editor";
import { EmailBlock } from "@/components/email-template-builder/types";
import { htmlToBlocks } from "@/components/email-template-builder/html-converter";

export type EmailBrandingTemplate = "minimal" | "centered" | "modern";

export interface EmailBrandingColors {
  primary: string;
  secondary: string;
  text: string;
  background: string;
}

interface EmailBrandingEditorProps {
  type: "header" | "footer";
  initialHtml?: string | null;
  initialTemplate?: EmailBrandingTemplate;
  initialColors?: EmailBrandingColors;
  logoUrl?: string | null;
  clinicName?: string;
  clinicPhone?: string | null;
  clinicEmail?: string | null;
  onSave: (html: string, template: EmailBrandingTemplate, colors: EmailBrandingColors) => Promise<void>;
}

const HEADER_TEMPLATES: Record<EmailBrandingTemplate, (colors: EmailBrandingColors, logoUrl: string | null, clinicName: string, phone: string | null, email: string | null) => EmailBlock[]> = {
  minimal: (colors, logoUrl, clinicName, phone, email) => [
    {
      id: "header-1",
      type: "divider",
      content: "",
      styles: { margin: "0 0 20px 0" },
    },
    ...(logoUrl ? [{
      id: "header-logo",
      type: "image" as const,
      content: logoUrl,
      styles: { textAlign: "left" as const, margin: "0 0 10px 0" },
    }] : []),
    {
      id: "header-name",
      type: "heading",
      content: clinicName || "{{nome_clinica}}",
      styles: { fontSize: "20px", fontWeight: "bold", textAlign: "left" as const, color: colors.text, margin: "0 0 8px 0" },
    },
    ...(phone || email ? [{
      id: "header-contact",
      type: "text" as const,
      content: `${phone ? `{{telefone_clinica}}` : ""}${phone && email ? " | " : ""}${email ? email : ""}`.trim(),
      styles: { fontSize: "14px", textAlign: "left" as const, color: colors.secondary, margin: "0" },
    }] : []),
  ],
  centered: (colors, logoUrl, clinicName, phone, email) => [
    {
      id: "header-spacer",
      type: "spacer",
      content: "",
      height: 20,
      styles: {},
    },
    ...(logoUrl ? [{
      id: "header-logo",
      type: "image" as const,
      content: logoUrl,
      styles: { textAlign: "center" as const, margin: "0 0 15px 0" },
    }] : []),
    {
      id: "header-name",
      type: "heading",
      content: clinicName || "{{nome_clinica}}",
      styles: { fontSize: "24px", fontWeight: "bold", textAlign: "center" as const, color: colors.primary, margin: "0 0 10px 0" },
    },
    ...(phone || email ? [{
      id: "header-contact",
      type: "text" as const,
      content: `${phone ? `{{telefone_clinica}}` : ""}${phone && email ? " • " : ""}${email ? email : ""}`,
      styles: { fontSize: "14px", textAlign: "center" as const, color: colors.text, margin: "0 0 20px 0" },
    }] : []),
    {
      id: "header-divider",
      type: "divider",
      content: "",
      styles: { margin: "0 0 20px 0" },
    },
  ],
  modern: (colors, logoUrl, clinicName, phone, email) => [
    {
      id: "header-spacer",
      type: "spacer",
      content: "",
      height: 10,
      styles: {},
    },
    {
      id: "header-container-start",
      type: "text" as const,
      content: `<div style="background-color: ${colors.primary}; padding: 20px; border-radius: 8px 8px 0 0; margin-bottom: 20px;">`,
      styles: { margin: "0" },
    },
    ...(logoUrl ? [{
      id: "header-logo",
      type: "image" as const,
      content: logoUrl,
      styles: { textAlign: "left" as const, margin: "0 0 10px 0" },
    }] : []),
    {
      id: "header-name",
      type: "heading",
      content: clinicName || "{{nome_clinica}}",
      styles: { fontSize: "22px", fontWeight: "bold", textAlign: "left" as const, color: "#ffffff", margin: "0 0 8px 0" },
    },
    ...(phone || email ? [{
      id: "header-contact",
      type: "text" as const,
      content: `${phone ? `{{telefone_clinica}}` : ""}${phone && email ? " | " : ""}${email ? email : ""}`.trim(),
      styles: { fontSize: "14px", textAlign: "left" as const, color: "#ffffff", margin: "0" },
    }] : []),
    {
      id: "header-container-end",
      type: "text" as const,
      content: "</div>",
      styles: { margin: "0" },
    },
  ],
};

const FOOTER_TEMPLATES: Record<EmailBrandingTemplate, (colors: EmailBrandingColors, clinicName: string, phone: string | null, email: string | null) => EmailBlock[]> = {
  minimal: (colors, clinicName, phone, email) => [
    {
      id: "footer-divider",
      type: "divider",
      content: "",
      styles: { margin: "20px 0" },
    },
    {
      id: "footer-text",
      type: "text" as const,
      content: "Este é um email automático. Em caso de dúvidas, entre em contato com a clínica.",
      styles: { fontSize: "12px", textAlign: "center" as const, color: colors.secondary, margin: "0" },
    },
    {
      id: "footer-spacer",
      type: "spacer",
      content: "",
      height: 10,
      styles: {},
    },
  ],
  centered: (colors, clinicName, phone, email) => [
    {
      id: "footer-divider",
      type: "divider",
      content: "",
      styles: { margin: "30px 0 20px 0" },
    },
    {
      id: "footer-name",
      type: "text" as const,
      content: clinicName || "{{nome_clinica}}",
      styles: { fontSize: "14px", fontWeight: "600", textAlign: "center" as const, color: colors.text, margin: "0 0 8px 0" },
    },
    ...(phone || email ? [{
      id: "footer-contact",
      type: "text" as const,
      content: `${phone ? `{{telefone_clinica}}` : ""}${phone && email ? " • " : ""}${email ? email : ""}`,
      styles: { fontSize: "12px", textAlign: "center" as const, color: colors.secondary, margin: "0 0 10px 0" },
    }] : []),
    {
      id: "footer-text",
      type: "text" as const,
      content: "Este é um email automático. Em caso de dúvidas, entre em contato com a clínica.",
      styles: { fontSize: "11px", textAlign: "center" as const, color: colors.secondary, margin: "0" },
    },
    {
      id: "footer-spacer",
      type: "spacer",
      content: "",
      height: 20,
      styles: {},
    },
  ],
  modern: (colors, clinicName, phone, email) => [
    {
      id: "footer-divider",
      type: "divider",
      content: "",
      styles: { margin: "30px 0 0 0" },
    },
    {
      id: "footer-container-start",
      type: "text" as const,
      content: `<div style="background-color: ${colors.background === "#ffffff" ? "#f5f5f5" : colors.background}; padding: 20px; border-radius: 0 0 8px 8px; margin-top: 0;">`,
      styles: { margin: "0" },
    },
    {
      id: "footer-name",
      type: "text" as const,
      content: clinicName || "{{nome_clinica}}",
      styles: { fontSize: "14px", fontWeight: "600", textAlign: "center" as const, color: colors.text, margin: "0 0 8px 0" },
    },
    ...(phone || email ? [{
      id: "footer-contact",
      type: "text" as const,
      content: `${phone ? `{{telefone_clinica}}` : ""}${phone && email ? " • " : ""}${email ? email : ""}`,
      styles: { fontSize: "12px", textAlign: "center" as const, color: colors.secondary, margin: "0 0 10px 0" },
    }] : []),
    {
      id: "footer-text",
      type: "text" as const,
      content: "Este é um email automático. Em caso de dúvidas, entre em contato com a clínica.",
      styles: { fontSize: "11px", textAlign: "center" as const, color: colors.secondary, margin: "0" },
    },
    {
      id: "footer-container-end",
      type: "text" as const,
      content: "</div>",
      styles: { margin: "0" },
    },
  ],
};

export function EmailBrandingEditor({
  type,
  initialHtml,
  initialTemplate = "minimal",
  initialColors = { primary: "#007bff", secondary: "#6c757d", text: "#333333", background: "#ffffff" },
  logoUrl,
  clinicName,
  clinicPhone,
  clinicEmail,
  onSave,
}: EmailBrandingEditorProps) {
  const [template, setTemplate] = useState<EmailBrandingTemplate>(initialTemplate);
  const [colors, setColors] = useState<EmailBrandingColors>(initialColors);
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [editorMode, setEditorMode] = useState<"visual" | "html">("visual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega template inicial ou HTML existente
  useEffect(() => {
    if (initialHtml) {
      try {
        const convertedBlocks = htmlToBlocks(initialHtml);
        if (convertedBlocks.length > 0) {
          setBlocks(convertedBlocks);
        } else {
          loadTemplate(template);
        }
      } catch (e) {
        loadTemplate(template);
      }
    } else {
      loadTemplate(template);
    }
  }, []);

  // Atualiza blocos quando template muda
  useEffect(() => {
    loadTemplate(template);
  }, [template, colors, logoUrl]);

  const loadTemplate = (selectedTemplate: EmailBrandingTemplate) => {
    const templateFn = type === "header" ? HEADER_TEMPLATES : FOOTER_TEMPLATES;
    const newBlocks = templateFn[selectedTemplate](
      colors,
      logoUrl || null,
      clinicName || "",
      clinicPhone || null,
      clinicEmail || null
    );
    setBlocks(newBlocks);
  };

  const handleBlocksChange = (newBlocks: EmailBlock[]) => {
    setBlocks(newBlocks);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const html = blocksToHtml(blocks);
      await onSave(html, template, colors);
    } catch (e: any) {
      setError(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">
              {type === "header" ? "Cabeçalho" : "Rodapé"} dos Emails
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Aplicado a todos os emails enviados pela clínica
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Seleção de Template */}
        <div>
          <Label>Escolha um Template</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {(["minimal", "centered", "modern"] as EmailBrandingTemplate[]).map((tpl) => (
              <Button
                key={tpl}
                type="button"
                variant={template === tpl ? "default" : "outline"}
                onClick={() => setTemplate(tpl)}
                className="capitalize"
              >
                {tpl === "minimal" ? "Mínimo" : tpl === "centered" ? "Centralizado" : "Moderno"}
              </Button>
            ))}
          </div>
        </div>

        {/* Customização de Cores */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`${type}-color-primary`}>Cor Primária</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id={`${type}-color-primary`}
                type="color"
                value={colors.primary}
                onChange={(e) => {
                  const newColors = { ...colors, primary: e.target.value };
                  setColors(newColors);
                  loadTemplate(template);
                }}
                className="h-10 w-20"
              />
              <Input
                type="text"
                value={colors.primary}
                onChange={(e) => {
                  const newColors = { ...colors, primary: e.target.value };
                  setColors(newColors);
                  loadTemplate(template);
                }}
                className="flex-1 font-mono text-sm"
                placeholder="#007bff"
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`${type}-color-secondary`}>Cor Secundária</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id={`${type}-color-secondary`}
                type="color"
                value={colors.secondary}
                onChange={(e) => {
                  const newColors = { ...colors, secondary: e.target.value };
                  setColors(newColors);
                  loadTemplate(template);
                }}
                className="h-10 w-20"
              />
              <Input
                type="text"
                value={colors.secondary}
                onChange={(e) => {
                  const newColors = { ...colors, secondary: e.target.value };
                  setColors(newColors);
                  loadTemplate(template);
                }}
                className="flex-1 font-mono text-sm"
                placeholder="#6c757d"
              />
            </div>
          </div>
        </div>

        {/* Editor Visual */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Editor</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditorMode(editorMode === "visual" ? "html" : "visual")}
            >
              {editorMode === "visual" ? "Ver HTML" : "Editor Visual"}
            </Button>
          </div>
          {editorMode === "visual" ? (
            <VisualEditor
              initialBlocks={blocks}
              onBlocksChange={handleBlocksChange}
              channel="email"
            />
          ) : (
            <div className="border rounded p-4 bg-muted/50">
              <pre className="text-xs font-mono overflow-auto max-h-64">
                {blocksToHtml(blocks)}
              </pre>
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}
