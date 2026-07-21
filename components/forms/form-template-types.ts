export type FormTemplateRow = {
  id: string;
  name: string;
  appointment_type_name: string | null;
  is_public: boolean;
  allowed_contexts?: string[];
  publicUrl?: string | null;
};

export type FormTemplatePatientOption = {
  id: string;
  full_name: string;
};
