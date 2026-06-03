"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FORM_FIELD_TYPES,
  type FormFieldDefinition,
  type FormFieldType,
  isChoiceType,
  hasPlaceholder,
} from "@/lib/form-types";
import { createDefaultField } from "@/lib/form-builder-utils";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  Calendar,
  Check,
  CircleDot,
  GripVertical,
  Hash,
  ListChecks,
  Plus,
  Search,
  ToggleLeft,
  Trash2,
  Type,
} from "lucide-react";

const PALETTE_META: Record<
  FormFieldType,
  { label: string; icon: typeof Type; description: string }
> = {
  single_choice: {
    label: "Seleção única",
    icon: CircleDot,
    description: "Radio — uma opção",
  },
  multiple_choice: {
    label: "Seleção múltipla",
    icon: ListChecks,
    description: "Checkbox — várias opções",
  },
  long_text: {
    label: "Editor de texto",
    icon: AlignLeft,
    description: "Parágrafo / evolução",
  },
  short_text: {
    label: "Texto curto",
    icon: Type,
    description: "Linha única",
  },
  number: {
    label: "Número",
    icon: Hash,
    description: "Valor numérico",
  },
  date: {
    label: "Data",
    icon: Calendar,
    description: "Seletor de data",
  },
  yes_no: {
    label: "Sim / Não",
    icon: ToggleLeft,
    description: "Alternância binária",
  },
};

function paletteId(type: FormFieldType) {
  return `palette-${type}`;
}

function isPaletteId(id: string) {
  return id.startsWith("palette-");
}

function typeFromPaletteId(id: string): FormFieldType {
  return id.replace("palette-", "") as FormFieldType;
}

function OptionsEditor({
  field,
  disabled,
  onUpdate,
  variant,
}: {
  field: FormFieldDefinition;
  disabled?: boolean;
  onUpdate: (options: string[]) => void;
  variant: "single_choice" | "multiple_choice";
}) {
  const [newOpt, setNewOpt] = useState("");
  const options = field.options ?? [];

  function addOption() {
    const t = newOpt.trim();
    if (!t || options.includes(t)) return;
    onUpdate([...options, t]);
    setNewOpt("");
  }

  return (
    <div>
      <Label className="text-xs">Opções</Label>
      <ul className="mt-1 space-y-1">
        {options.map((opt, idx) => (
          <li
            key={`${opt}-${idx}`}
            className="flex items-center gap-2 rounded border bg-muted/30 px-2 py-1.5"
          >
            <span className="flex-1 text-sm">{opt}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onUpdate(options.filter((_, i) => i !== idx))}
              disabled={disabled}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Input
          value={newOpt}
          onChange={(e) => setNewOpt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
          placeholder="Nova opção"
          className="flex-1 h-9"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOption}
          disabled={disabled || !newOpt.trim()}
        >
          {variant === "multiple_choice" ? (
            <Plus className="h-4 w-4" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function PaletteCard({
  type,
  disabled,
  onAdd,
}: {
  type: FormFieldType;
  disabled?: boolean;
  onAdd: (type: FormFieldType) => void;
}) {
  const meta = PALETTE_META[type];
  const Icon = meta.icon;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: paletteId(type),
    disabled,
    data: { type: "palette", fieldType: type },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={disabled}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onAdd(type)}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border bg-card p-3 text-center transition-colors",
        "hover:border-primary/50 hover:bg-primary/5 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 border-primary/50",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-medium leading-tight">{meta.label}</span>
    </button>
  );
}

function SortableFieldCard({
  field,
  disabled,
  onUpdate,
  onRemove,
  expanded,
  onToggleExpand,
}: {
  field: FormFieldDefinition;
  disabled?: boolean;
  onUpdate: (patch: Partial<FormFieldDefinition>) => void;
  onRemove: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const meta = PALETTE_META[field.type];
  const Icon = meta.icon;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card shadow-sm",
        isDragging && "ring-2 ring-primary/30"
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-1"
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label="Arrastar campo"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <button
          type="button"
          className="flex-1 min-w-0 text-left"
          onClick={onToggleExpand}
        >
          <p className="text-sm font-medium truncate">
            {field.label.trim() || meta.label}
          </p>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </button>
        {field.required && (
          <span className="text-[10px] uppercase tracking-wide text-primary font-medium shrink-0">
            Obrigatório
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={disabled}
          className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-muted/20">
          <div>
            <Label className="text-xs">Rótulo do campo</Label>
            <Input
              value={field.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="Ex.: Queixa principal"
              className="mt-1 h-9"
              disabled={disabled}
            />
          </div>
          <label className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
            <span>Obrigatório</span>
            <input
              type="checkbox"
              checked={field.required ?? false}
              onChange={(e) => onUpdate({ required: e.target.checked })}
              disabled={disabled}
              className="h-4 w-4"
            />
          </label>
          {hasPlaceholder(field.type) && (
            <div>
              <Label className="text-xs">Descrição / placeholder</Label>
              <Input
                value={field.placeholder ?? ""}
                onChange={(e) =>
                  onUpdate({ placeholder: e.target.value || undefined })
                }
                placeholder="Texto de ajuda para quem preenche"
                className="mt-1 h-9"
                disabled={disabled}
              />
            </div>
          )}
          {isChoiceType(field.type) && (
            <OptionsEditor
              field={field}
              disabled={disabled}
              onUpdate={(options) => onUpdate({ options })}
              variant={field.type}
            />
          )}
          {field.type === "number" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Mínimo</Label>
                <Input
                  type="number"
                  value={field.min ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      min: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    })
                  }
                  className="mt-1 h-9"
                  disabled={disabled}
                />
              </div>
              <div>
                <Label className="text-xs">Máximo</Label>
                <Input
                  type="number"
                  value={field.max ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      max: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    })
                  }
                  className="mt-1 h-9"
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CanvasDropZone({
  children,
  isEmpty,
}: {
  children: React.ReactNode;
  isEmpty: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-drop" });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[320px] rounded-xl border-2 border-dashed p-4 transition-colors",
        isEmpty && "flex items-center justify-center",
        isOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/10"
      )}
    >
      {isEmpty ? (
        <div className="text-center pointer-events-none select-none px-6">
          <p className="text-sm font-medium text-muted-foreground">
            Arraste e solte um campo aqui
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ou clique duplo em um tipo na barra lateral
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function FormBuilderDnd({
  definition,
  onChange,
  disabled,
}: {
  definition: FormFieldDefinition[];
  onChange: (def: FormFieldDefinition[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filteredTypes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return FORM_FIELD_TYPES.filter((t) => {
      if (!q) return true;
      const meta = PALETTE_META[t.value];
      return (
        meta.label.toLowerCase().includes(q) ||
        meta.description.toLowerCase().includes(q)
      );
    }).map((t) => t.value);
  }, [search]);

  function addField(type: FormFieldType, insertBeforeId?: string) {
    const field = createDefaultField(type);
    if (!insertBeforeId) {
      onChange([...definition, field]);
    } else {
      const idx = definition.findIndex((f) => f.id === insertBeforeId);
      if (idx < 0) onChange([...definition, field]);
      else {
        const next = [...definition];
        next.splice(idx, 0, field);
        onChange(next);
      }
    }
    setExpandedId(field.id);
  }

  function updateField(id: string, patch: Partial<FormFieldDefinition>) {
    onChange(definition.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    onChange(definition.filter((f) => f.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || disabled) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (isPaletteId(activeId)) {
      const type = typeFromPaletteId(activeId);
      if (overId === "canvas-drop") {
        addField(type);
        return;
      }
      const overField = definition.find((f) => f.id === overId);
      if (overField) addField(type, overId);
      return;
    }

    const oldIndex = definition.findIndex((f) => f.id === activeId);
    const newIndex = definition.findIndex((f) => f.id === overId);
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      onChange(arrayMove(definition, oldIndex, newIndex));
    }
  }

  const activePaletteType = activeDragId && isPaletteId(activeDragId)
    ? typeFromPaletteId(activeDragId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col lg:flex-row gap-0 min-h-[420px] rounded-xl border overflow-hidden bg-background">
        {/* Paleta lateral */}
        <aside className="w-full lg:w-56 xl:w-64 shrink-0 border-b lg:border-b-0 lg:border-r bg-muted/20 p-4">
          <h3 className="text-sm font-semibold">Adicionar novo campo</h3>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Arraste ou clique duplo para adicionar
          </p>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="pl-8 h-9 text-sm"
              disabled={disabled}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-0.5">
            {filteredTypes.map((type) => (
              <PaletteCard
                key={type}
                type={type}
                disabled={disabled}
                onAdd={addField}
              />
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <div className="flex-1 p-4 min-w-0">
          <CanvasDropZone isEmpty={definition.length === 0}>
            {definition.length > 0 && (
              <SortableContext
                items={definition.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-3">
                  {definition.map((field) => (
                    <li key={field.id}>
                      <SortableFieldCard
                        field={field}
                        disabled={disabled}
                        onUpdate={(patch) => updateField(field.id, patch)}
                        onRemove={() => removeField(field.id)}
                        expanded={expandedId === field.id}
                        onToggleExpand={() =>
                          setExpandedId((id) => (id === field.id ? null : field.id))
                        }
                      />
                    </li>
                  ))}
                </ul>
              </SortableContext>
            )}
          </CanvasDropZone>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activePaletteType && (
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg opacity-90">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              {(() => {
                const Icon = PALETTE_META[activePaletteType].icon;
                return <Icon className="h-4 w-4" />;
              })()}
            </div>
            <span className="text-sm font-medium">
              {PALETTE_META[activePaletteType].label}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
