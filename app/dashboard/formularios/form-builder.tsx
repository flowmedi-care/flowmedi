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
import { Plus, Trash2 } from "lucide-react";

function generateId() {
  return crypto.randomUUID();
}

const defaultField = (): FormFieldDefinition => ({
  id: generateId(),
  type: "short_text",
  label: "",
  required: false,
});

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
    <div className="space-y-2">
      <Label>Campos do formulário</Label>
      <p className="text-sm text-muted-foreground mb-2">
        Adicione os campos e escolha o tipo de input para cada um.
      </p>
      <ul className="space-y-2">
        {definition.map((field) => (
          <li
            key={field.id}
            className="border border-border rounded-lg p-3 bg-card"
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
                    <Label className="text-xs">Placeholder</Label>
                    <Input
                      value={field.placeholder ?? ""}
                      onChange={(e) =>
                        updateField(field.id, {
                          placeholder: e.target.value || undefined,
                        })
                      }
                      placeholder="Ex.: Digite aqui..."
                      className="mt-1"
                      disabled={disabled}
                    />
                  </div>
                )}
                {isChoiceType(field.type) && (
                  <div>
                    <Label className="text-xs">
                      Opções (uma por linha)
                    </Label>
                    <Textarea
                      value={(field.options ?? []).join("\n")}
                      onChange={(e) =>
                        updateField(field.id, {
                          options: e.target.value
                            .split("\n")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Sim&#10;Não"
                      rows={3}
                      className="mt-1 font-mono text-sm"
                      disabled={disabled}
                    />
                  </div>
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
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addField}
        disabled={disabled}
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar campo
      </Button>
    </div>
  );
}
