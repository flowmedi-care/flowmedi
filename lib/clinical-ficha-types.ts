import type { FormFieldDefinition } from "@/lib/form-types";

export type ClinicalFichaType = "fields" | "prescription" | "exam_request" | "notes" | "certificate";

export type ClinicalFichaTemplate = {
  id: string;
  clinic_id: string;
  name: string;
  slug: string;
  ficha_type: ClinicalFichaType;
  definition: FormFieldDefinition[];
  display_order: number;
  is_system: boolean;
  active: boolean;
};

export type AppointmentFichaInstance = {
  id: string;
  appointment_id: string;
  ficha_template_id: string;
  responses: Record<string, unknown>;
  status: "rascunho" | "concluida";
  filled_by: string | null;
  updated_at: string;
  template: ClinicalFichaTemplate;
};

export type AppointmentFichaSummary = {
  instance_id: string;
  ficha_name: string;
  ficha_type: ClinicalFichaType;
  status: string;
  updated_at: string;
  appointment_id: string;
  scheduled_at: string;
};

export type FichaHistoryAppointment = {
  appointment_id: string;
  scheduled_at: string;
  doctor_name: string | null;
  is_current_appointment: boolean;
  fichas: AppointmentFichaInstance[];
};

export type FichaCopySourceFicha = {
  ficha_template_id: string;
  template_name: string;
  has_content: boolean;
};

export type FichaCopySource = {
  appointment_id: string;
  scheduled_at: string;
  doctor_name: string | null;
  fichas: FichaCopySourceFicha[];
};

export type CopyFichaResult = {
  copied: number;
  skipped: number;
  messages: string[];
};

export type AppointmentFichaDetail = AppointmentFichaSummary & {
  definition: FormFieldDefinition[];
  responses: Record<string, unknown>;
};
