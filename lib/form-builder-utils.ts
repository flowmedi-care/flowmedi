import type { FormFieldDefinition, FormFieldType } from "@/lib/form-types";
import { isChoiceType } from "@/lib/form-types";

export function createDefaultField(type: FormFieldType): FormFieldDefinition {
  return {
    id: crypto.randomUUID(),
    type,
    label: "",
    required: false,
    options: isChoiceType(type) ? [] : undefined,
  };
}
