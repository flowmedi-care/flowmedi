"use client";

import { useState } from "react";
import { EmailBlock, EmailTemplateData } from "./types";
import { BlockComponent } from "./block-components";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { 
  Plus, 
  Heading1, 
  Type, 
  Square, 
  Hash, 
  Minus, 
  Image as ImageIcon,
  Eye,
  Code
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const AVAILABLE_VARIABLES = [
  "{{nome_paciente}}",
  "{{email_paciente}}",
  "{{telefone_paciente}}",
  "{{data_nascimento}}",
  "{{data_consulta}}",
  "{{hora_consulta}}",
  "{{data_hora_consulta}}",
  "{{nome_medico}}",
  "{{tipo_consulta}}",
  "{{nome_procedimento}}",
  "{{status_consulta}}",
  "{{recomendacoes}}",
  "{{precisa_jejum}}",
  "{{instrucoes_especiais}}",
  "{{notas_preparo}}",
  "{{preparo_completo}}",
  "{{link_formulario}}",
  "{{nome_formulario}}",
  "{{prazo_formulario}}",
  "{{instrucao_formulario}}",
  "{{nome_clinica}}",
  "{{telefone_clinica}}",
  "{{endereco_clinica}}",
];

interface VisualEditorProps {
  initialBlocks?: EmailBlock[];
  onBlocksChange: (blocks: EmailBlock[]) => void;
  channel: "email" | "whatsapp";
}

function SortableBlock({ 
  block, 
  onUpdate, 
  onDelete, 
  isEditing, 
  onEdit,
  availableVariables 
}: {
  block: EmailBlock;
  onUpdate: (block: EmailBlock) => void;
  onDelete: () => void;
  isEditing: boolean;
  onEdit: () => void;
  availableVariables: string[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <BlockComponent
        block={block}
        onUpdate={onUpdate}
        onDelete={onDelete}
        isEditing={isEditing}
        onEdit={onEdit}
        availableVariables={availableVariables}
      />
    </div>
  );
}

export function VisualEditor({ initialBlocks = [], onBlocksChange, channel }: VisualEditorProps) {
  const [blocks, setBlocks] = useState<EmailBlock[]>(initialBlocks);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddBlock = (type: EmailBlock["type"]) => {
    const newBlock: EmailBlock = {
      id: `block-${Date.now()}-${Math.random()}`,
      type,
      content: "",
      styles: {},
    };

    if (type === "spacer") {
      newBlock.height = 20;
    }

    if (type === "button") {
      newBlock.buttonText = "Clique aqui";
      newBlock.buttonUrl = "#";
      newBlock.buttonStyle = "primary";
      newBlock.styles = { textAlign: "center" };
    }

    if (type === "variable") {
      newBlock.variableName = "";
    }

    const newBlocks = [...blocks, newBlock];
    setBlocks(newBlocks);
    onBlocksChange(newBlocks);
    setEditingBlockId(newBlock.id);
  };

  const handleUpdateBlock = (updatedBlock: EmailBlock) => {
    const newBlocks = blocks.map((b) => 
      b.id === updatedBlock.id ? updatedBlock : b
    );
    setBlocks(newBlocks);
    onBlocksChange(newBlocks);
  };

  const handleDeleteBlock = (blockId: string) => {
    const newBlocks = blocks.filter((b) => b.id !== blockId);
    setBlocks(newBlocks);
    onBlocksChange(newBlocks);
    if (editingBlockId === blockId) {
      setEditingBlockId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newBlocks = arrayMove(items, oldIndex, newIndex);
        onBlocksChange(newBlocks);
        return newBlocks;
      });
    }
  };

  const blocksToHtml = (blocks: EmailBlock[]): string => {
    return blocks.map((block) => {
      switch (block.type) {
        case "heading":
          return `<h2 style="font-size: ${block.styles?.fontSize || "24px"}; font-weight: ${block.styles?.fontWeight || "bold"}; text-align: ${block.styles?.textAlign || "left"}; color: ${block.styles?.color || "inherit"}; margin: ${block.styles?.margin || "16px 0"};">${block.content}</h2>`;
        case "text":
          return `<p style="font-size: ${block.styles?.fontSize || "16px"}; text-align: ${block.styles?.textAlign || "left"}; color: ${block.styles?.color || "inherit"}; margin: ${block.styles?.margin || "8px 0"}; padding: ${block.styles?.padding || "0"};">${block.content}</p>`;
        case "button":
          const buttonBg = block.buttonStyle === "primary" ? "#007bff" : block.buttonStyle === "secondary" ? "#6c757d" : "transparent";
          const buttonColor = block.buttonStyle === "outline" ? "#007bff" : "white";
          const buttonBorder = block.buttonStyle === "outline" ? "2px solid #007bff" : "none";
          return `<div style="text-align: ${block.styles?.textAlign || "center"}; margin: ${block.styles?.margin || "16px 0"};"><a href="${block.buttonUrl || "#"}" style="display: inline-block; padding: 12px 24px; background-color: ${buttonBg}; color: ${buttonColor}; border: ${buttonBorder}; border-radius: 6px; text-decoration: none; font-weight: 600;">${block.buttonText || "Clique aqui"}</a></div>`;
        case "variable":
          return `<span style="display: inline-block; padding: 4px 8px; background-color: #e3f2fd; color: #1976d2; border-radius: 4px; font-family: monospace; font-size: 14px; margin: ${block.styles?.margin || "4px 0"};">${block.variableName || block.content}</span>`;
        case "spacer":
          return `<div style="height: ${block.height || 20}px; width: 100%;"></div>`;
        case "divider":
          return `<hr style="border: none; border-top: 1px solid #e0e0e0; margin: ${block.styles?.margin || "16px 0"};" />`;
        case "image":
          return `<div style="text-align: ${block.styles?.textAlign || "center"}; margin: ${block.styles?.margin || "16px 0"};"><img src="${block.content || "https://via.placeholder.com/400x200"}" alt="Imagem" style="max-width: 100%; height: auto;" /></div>`;
        default:
          return "";
      }
    }).join("\n");
  };

  const renderPreview = () => {
    const html = blocksToHtml(blocks);
    return (
      <div className="border rounded-lg p-6 bg-white max-w-2xl mx-auto">
        <div 
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Editor Visual</h3>
          <p className="text-sm text-muted-foreground">
            Adicione blocos para criar seu template de forma visual
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={showPreview ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <Code className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showPreview ? "Editar" : "Preview"}
          </Button>
        </div>
      </div>

      {showPreview ? (
        <Card>
          <CardContent className="pt-6">
            {renderPreview()}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Toolbar de Blocos */}
          <Card>
            <CardHeader>
              <h4 className="text-sm font-semibold">Adicionar Bloco</h4>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddBlock("heading")}
                  className="flex flex-col items-center gap-2 h-auto py-3"
                >
                  <Heading1 className="h-5 w-5" />
                  <span className="text-xs">Título</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddBlock("text")}
                  className="flex flex-col items-center gap-2 h-auto py-3"
                >
                  <Type className="h-5 w-5" />
                  <span className="text-xs">Texto</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddBlock("button")}
                  className="flex flex-col items-center gap-2 h-auto py-3"
                >
                  <Square className="h-5 w-5" />
                  <span className="text-xs">Botão</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddBlock("variable")}
                  className="flex flex-col items-center gap-2 h-auto py-3"
                >
                  <Hash className="h-5 w-5" />
                  <span className="text-xs">Variável</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddBlock("spacer")}
                  className="flex flex-col items-center gap-2 h-auto py-3"
                >
                  <Minus className="h-5 w-5" />
                  <span className="text-xs">Espaço</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddBlock("divider")}
                  className="flex flex-col items-center gap-2 h-auto py-3"
                >
                  <Minus className="h-5 w-5 rotate-90" />
                  <span className="text-xs">Divisor</span>
                </Button>
                {channel === "email" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddBlock("image")}
                    className="flex flex-col items-center gap-2 h-auto py-3"
                  >
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-xs">Imagem</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lista de Blocos */}
          <Card>
            <CardContent className="pt-6">
              {blocks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">Nenhum bloco adicionado ainda.</p>
                  <p className="text-xs mt-1">Use os botões acima para adicionar elementos ao seu template.</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={blocks.map((b) => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {blocks.map((block) => (
                        <SortableBlock
                          key={block.id}
                          block={block}
                          onUpdate={handleUpdateBlock}
                          onDelete={() => handleDeleteBlock(block.id)}
                          isEditing={editingBlockId === block.id}
                          onEdit={() => setEditingBlockId(block.id === editingBlockId ? null : block.id)}
                          availableVariables={AVAILABLE_VARIABLES}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export function blocksToHtml(blocks: EmailBlock[]): string {
  return blocks.map((block) => {
    switch (block.type) {
      case "heading":
        return `<h2 style="font-size: ${block.styles?.fontSize || "24px"}; font-weight: ${block.styles?.fontWeight || "bold"}; text-align: ${block.styles?.textAlign || "left"}; color: ${block.styles?.color || "inherit"}; margin: ${block.styles?.margin || "16px 0"};">${block.content}</h2>`;
      case "text":
        return `<p style="font-size: ${block.styles?.fontSize || "16px"}; text-align: ${block.styles?.textAlign || "left"}; color: ${block.styles?.color || "inherit"}; margin: ${block.styles?.margin || "8px 0"}; padding: ${block.styles?.padding || "0"};">${block.content}</p>`;
      case "button":
        const buttonBg = block.buttonStyle === "primary" ? "#007bff" : block.buttonStyle === "secondary" ? "#6c757d" : "transparent";
        const buttonColor = block.buttonStyle === "outline" ? "#007bff" : "white";
        const buttonBorder = block.buttonStyle === "outline" ? "2px solid #007bff" : "none";
        return `<div style="text-align: ${block.styles?.textAlign || "center"}; margin: ${block.styles?.margin || "16px 0"};"><a href="${block.buttonUrl || "#"}" style="display: inline-block; padding: 12px 24px; background-color: ${buttonBg}; color: ${buttonColor}; border: ${buttonBorder}; border-radius: 6px; text-decoration: none; font-weight: 600;">${block.buttonText || "Clique aqui"}</a></div>`;
      case "variable":
        return block.variableName || block.content;
      case "spacer":
        return `<div style="height: ${block.height || 20}px; width: 100%;"></div>`;
      case "divider":
        return `<hr style="border: none; border-top: 1px solid #e0e0e0; margin: ${block.styles?.margin || "16px 0"};" />`;
      case "image":
        return `<div style="text-align: ${block.styles?.textAlign || "center"}; margin: ${block.styles?.margin || "16px 0"};"><img src="${block.content || "https://via.placeholder.com/400x200"}" alt="Imagem" style="max-width: 100%; height: auto;" /></div>`;
      default:
        return "";
    }
  }).join("\n");
}
