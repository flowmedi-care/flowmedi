export type FormTemplateRow = {
  id: string;
  name: string;
  appointment_type_name: string | null;
  is_public: boolean;
  publicUrl?: string | null;
};

export type FormTemplatePatientOption = {
  id: string;
  full_name: string;
};
