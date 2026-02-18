"use client";

import { EmailBlock } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { GripVertical, X, Type, Heading1, Square, Minus, Image as ImageIcon, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlockComponentProps {
  block: EmailBlock;
  onUpdate: (block: EmailBlock) => void;
  onDelete: () => void;
  isEditing: boolean;
  onEdit: () => void;
  availableVariables: string[];
}

export function BlockComponent({ 
  block, 
  onUpdate, 
  onDelete, 
  isEditing, 
  onEdit,
  availableVariables 
}: BlockComponentProps) {
  const renderPreview = () => {
    switch (block.type) {
      case "heading":
        return (
          <h2 
            style={{
              fontSize: block.styles?.fontSize || "24px",
              fontWeight: block.styles?.fontWeight || "bold",
              textAlign: block.styles?.textAlign || "left",
              color: block.styles?.color || "inherit",
              margin: block.styles?.margin || "16px 0",
            }}
            dangerouslySetInnerHTML={{ __html: block.content }}
          />
        );
      case "text":
        return (
          <p 
            style={{
              fontSize: block.styles?.fontSize || "16px",
              textAlign: block.styles?.textAlign || "left",
              color: block.styles?.color || "inherit",
              margin: block.styles?.margin || "8px 0",
              padding: block.styles?.padding || "0",
            }}
            dangerouslySetInnerHTML={{ __html: block.content }}
          />
        );
      case "button":
        return (
          <div style={{ textAlign: block.styles?.textAlign || "center", margin: block.styles?.margin || "16px 0" }}>
            <a
              href={block.buttonUrl || "#"}
              style={{
                display: "inline-block",
                padding: "12px 24px",
                backgroundColor: block.buttonStyle === "primary" ? "#007bff" : block.buttonStyle === "secondary" ? "#6c757d" : "transparent",
                color: block.buttonStyle === "outline" ? "#007bff" : "white",
                border: block.buttonStyle === "outline" ? "2px solid #007bff" : "none",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "600",
              }}
            >
              {block.buttonText || "Clique aqui"}
            </a>
          </div>
        );
      case "variable":
        return (
          <span 
            className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded font-mono text-sm"
            style={{ margin: block.styles?.margin || "4px 0" }}
          >
            {block.variableName || block.content}
          </span>
        );
      case "spacer":
        return (
          <div style={{ height: `${block.height || 20}px`, width: "100%" }} />
        );
      case "divider":
        return (
          <hr style={{ 
            border: "none", 
            borderTop: "1px solid #e0e0e0", 
            margin: block.styles?.margin || "16px 0" 
          }} />
        );
      case "image":
        return (
          <div style={{ textAlign: block.styles?.textAlign || "center", margin: block.styles?.margin || "16px 0" }}>
            <img 
              src={block.content || "https://via.placeholder.com/400x200"} 
              alt="Imagem" 
              style={{ maxWidth: "100%", height: "auto" }}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const getBlockIcon = () => {
    switch (block.type) {
      case "heading": return <Heading1 className="h-4 w-4" />;
      case "text": return <Type className="h-4 w-4" />;
      case "button": return <Square className="h-4 w-4" />;
      case "variable": return <Hash className="h-4 w-4" />;
      case "spacer": return <Minus className="h-4 w-4" />;
      case "divider": return <Minus className="h-4 w-4" />;
      case "image": return <ImageIcon className="h-4 w-4" />;
      default: return <Square className="h-4 w-4" />;
    }
  };

  if (isEditing) {
    return (
      <div className="border-2 border-primary rounded-lg p-4 bg-background">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium capitalize">{block.type}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {block.type === "heading" && (
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Textarea
                value={block.content}
                onChange={(e) => onUpdate({ ...block, content: e.target.value })}
                rows={2}
                placeholder="Digite o título..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tamanho da fonte</Label>
                <Input
                  type="text"
                  value={block.styles?.fontSize || "24px"}
                  onChange={(e) => onUpdate({ 
                    ...block, 
                    styles: { ...block.styles, fontSize: e.target.value } 
                  })}
                  placeholder="24px"
                />
              </div>
              <div>
                <Label>Alinhamento</Label>
                <select
                  value={block.styles?.textAlign || "left"}
                  onChange={(e) => onUpdate({ 
                    ...block, 
                    styles: { ...block.styles, textAlign: e.target.value as any } 
                  })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="left">Esquerda</option>
                  <option value="center">Centro</option>
                  <option value="right">Direita</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {block.type === "text" && (
          <div className="space-y-3">
            <div>
              <Label>Texto</Label>
              <Textarea
                value={block.content}
                onChange={(e) => onUpdate({ ...block, content: e.target.value })}
                rows={4}
                placeholder="Digite o texto..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tamanho da fonte</Label>
                <Input
                  type="text"
                  value={block.styles?.fontSize || "16px"}
                  onChange={(e) => onUpdate({ 
                    ...block, 
                    styles: { ...block.styles, fontSize: e.target.value } 
                  })}
                  placeholder="16px"
                />
              </div>
              <div>
                <Label>Alinhamento</Label>
                <select
                  value={block.styles?.textAlign || "left"}
                  onChange={(e) => onUpdate({ 
                    ...block, 
                    styles: { ...block.styles, textAlign: e.target.value as any } 
                  })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="left">Esquerda</option>
                  <option value="center">Centro</option>
                  <option value="right">Direita</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Inserir Variável</Label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    const cursorPos = (document.activeElement as HTMLTextAreaElement)?.selectionStart || 0;
                    const textarea = document.activeElement as HTMLTextAreaElement;
                    if (textarea) {
                      const text = block.content;
                      const newText = text.substring(0, cursorPos) + e.target.value + text.substring(cursorPos);
                      onUpdate({ ...block, content: newText });
                      e.target.value = "";
                    }
                  }
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione uma variável...</option>
                {availableVariables.map((variable) => (
                  <option key={variable} value={variable}>{variable}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {block.type === "button" && (
          <div className="space-y-3">
            <div>
              <Label>Texto do Botão</Label>
              <Input
                value={block.buttonText || ""}
                onChange={(e) => onUpdate({ ...block, buttonText: e.target.value })}
                placeholder="Clique aqui"
              />
            </div>
            <div>
              <Label>URL do Botão</Label>
              <Input
                value={block.buttonUrl || ""}
                onChange={(e) => onUpdate({ ...block, buttonUrl: e.target.value })}
                placeholder="https://exemplo.com"
              />
            </div>
            <div>
              <Label>Estilo</Label>
              <select
                value={block.buttonStyle || "primary"}
                onChange={(e) => onUpdate({ 
                  ...block, 
                  buttonStyle: e.target.value as any 
                })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="primary">Primário</option>
                <option value="secondary">Secundário</option>
                <option value="outline">Contorno</option>
              </select>
            </div>
            <div>
              <Label>Alinhamento</Label>
              <select
                value={block.styles?.textAlign || "center"}
                onChange={(e) => onUpdate({ 
                  ...block, 
                  styles: { ...block.styles, textAlign: e.target.value as any } 
                })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </div>
          </div>
        )}

        {block.type === "variable" && (
          <div>
            <Label>Variável</Label>
            <select
              value={block.variableName || block.content}
              onChange={(e) => onUpdate({ 
                ...block, 
                variableName: e.target.value,
                content: e.target.value 
              })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione uma variável...</option>
              {availableVariables.map((variable) => (
                <option key={variable} value={variable}>{variable}</option>
              ))}
            </select>
          </div>
        )}

        {block.type === "spacer" && (
          <div>
            <Label>Altura (px)</Label>
            <Input
              type="number"
              value={block.height || 20}
              onChange={(e) => onUpdate({ ...block, height: parseInt(e.target.value) || 20 })}
              min={10}
              max={200}
            />
          </div>
        )}

        {block.type === "image" && (
          <div className="space-y-3">
            <div>
              <Label>URL da Imagem</Label>
              <Input
                value={block.content}
                onChange={(e) => onUpdate({ ...block, content: e.target.value })}
                placeholder="https://exemplo.com/imagem.jpg"
              />
            </div>
            <div>
              <Label>Alinhamento</Label>
              <select
                value={block.styles?.textAlign || "center"}
                onChange={(e) => onUpdate({ 
                  ...block, 
                  styles: { ...block.styles, textAlign: e.target.value as any } 
                })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t">
          <Button type="button" variant="outline" size="sm" onClick={onEdit} className="w-full">
            Concluir Edição
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="group relative border border-transparent hover:border-primary/50 rounded-lg p-2 transition-colors cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-start gap-2">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-1" />
        </div>
        <div className="flex-1">
          {renderPreview()}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
