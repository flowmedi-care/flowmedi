"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FORM_FIELD_TYPES,
  type FormFieldDefinition,
  type FormFieldType,
  isChoiceType,
  hasPlaceholder,
  hasOptions,
  hasMinMax,
} from "@/lib/form-types";
import { Plus, Trash2, Check } from "lucide-react";

function generateId() {
  return crypto.randomUUID();
}

const defaultField = (): FormFieldDefinition => ({
  id: generateId(),
  type: "short_text",
  label: "",
  required: false,
});

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

  function removeOption(idx: number) {
    onUpdate(options.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <Label className="text-xs">Opções</Label>
      <ul className="mt-1 space-y-1">
        {options.map((opt, idx) => (
          <li
            key={`${opt}-${idx}`}
            className="flex items-center gap-2 rounded border border-border bg-muted/30 px-2 py-1.5"
          >
            <span className="flex-1 text-sm">{opt}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeOption(idx)}
              disabled={disabled}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              aria-label="Remover opção"
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
          className="flex-1"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOption}
          disabled={disabled || !newOpt.trim()}
          title={variant === "multiple_choice" ? "Adicionar opção" : "Confirmar opção"}
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

export function FormBuilder({
  definition,
  onChange,
  disabled,
}: {
  definition: FormFieldDefinition[];
  onChange: (def: FormFieldDefinition[]) => void;
  disabled?: boolean;
}) {
  function addField() {
    onChange([...definition, defaultField()]);
  }

  function removeField(id: string) {
    onChange(definition.filter((f) => f.id !== id));
  }

  function updateField(id: string, patch: Partial<FormFieldDefinition>) {
    onChange(
      definition.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  }

  return (
    <div className="space-y-4">
      {definition.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Nenhum campo adicionado ainda</p>
          <p className="text-xs mt-1">Clique em "Adicionar campo" para começar</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {definition.map((field) => (
            <li
              key={field.id}
              className="border border-border rounded-lg p-4 bg-card hover:border-primary/50 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                value={field.type}
                onChange={(e) =>
                  updateField(field.id, {
                    type: e.target.value as FormFieldType,
                    options: isChoiceType(e.target.value as FormFieldType)
                      ? field.options ?? []
                      : undefined,
                  })
                }
                disabled={disabled}
              >
                {FORM_FIELD_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Rótulo do campo"
                value={field.label}
                onChange={(e) =>
                  updateField(field.id, { label: e.target.value })
                }
                className="flex-1 min-w-[180px]"
                disabled={disabled}
              />
              <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={field.required ?? false}
                  onChange={(e) =>
                    updateField(field.id, { required: e.target.checked })
                  }
                  disabled={disabled}
                />
                Obrigatório
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeField(field.id)}
                disabled={disabled}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {(hasPlaceholder(field.type) || hasOptions(field.type) || hasMinMax(field.type)) && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                {hasPlaceholder(field.type) && (
                  <div>
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      value={field.placeholder ?? ""}
                      onChange={(e) =>
                        updateField(field.id, {
                          placeholder: e.target.value || undefined,
                        })
                      }
                      placeholder="Ex.: Descrição do campo..."
                      className="mt-1"
                      disabled={disabled}
                    />
                  </div>
                )}
                {isChoiceType(field.type) && (
                  <OptionsEditor
                    field={field}
                    disabled={disabled}
                    onUpdate={(options) =>
                      updateField(field.id, { options })
                    }
                    variant={field.type}
                  />
                )}
                {field.type === "number" && (
                  <div className="flex gap-4">
                    <div>
                      <Label className="text-xs">Mínimo</Label>
                      <Input
                        type="number"
                        value={field.min ?? ""}
                        onChange={(e) =>
                          updateField(field.id, {
                            min: e.target.value
                              ? parseInt(e.target.value, 10)
                              : undefined,
                          })
                        }
                        className="mt-1 w-24"
                        disabled={disabled}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Máximo</Label>
                      <Input
                        type="number"
                        value={field.max ?? ""}
                        onChange={(e) =>
                          updateField(field.id, {
                            max: e.target.value
                              ? parseInt(e.target.value, 10)
                              : undefined,
                          })
                        }
                        className="mt-1 w-24"
                        disabled={disabled}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={addField}
        disabled={disabled}
        className="w-full sm:w-auto"
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar campo
      </Button>
    </div>
  );
}
