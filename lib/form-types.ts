// Tipos de campo do formulário (construtor + renderização)
export const FORM_FIELD_TYPES = [
  { value: "short_text", label: "Texto curto" },
  { value: "long_text", label: "Texto longo (parágrafo)" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "yes_no", label: "Sim / Não" },
  { value: "single_choice", label: "Escolha única" },
  { value: "multiple_choice", label: "Múltipla escolha" },
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number]["value"];

export type FormFieldDefinition = {
  id: string;
  type: FormFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
};

export type FormTemplateDefinition = FormFieldDefinition[];

export function isChoiceType(t: FormFieldType): t is "single_choice" | "multiple_choice" {
  return t === "single_choice" || t === "multiple_choice";
}

export function hasPlaceholder(t: FormFieldType): boolean {
  return t === "short_text" || t === "long_text" || t === "number";
}

export function hasOptions(t: FormFieldType): boolean {
  return isChoiceType(t);
}

export function hasMinMax(t: FormFieldType): boolean {
  return t === "number";
}
