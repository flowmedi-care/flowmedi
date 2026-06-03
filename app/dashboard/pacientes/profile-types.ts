export const EVENT_LABELS: Record<string, string> = {
  patient_registered: "Paciente cadastrado",
  appointment_created: "Consulta agendada",
  appointment_confirmed: "Consulta confirmada",
  appointment_rescheduled: "Consulta remarcada",
  appointment_completed: "Consulta realizada",
  appointment_no_show: "Falta na consulta",
  appointment_canceled: "Consulta cancelada",
  form_linked: "Formulário vinculado",
  patient_form_completed: "Formulário respondido",
  public_form_completed: "Formulário público preenchido",
};

export type PatientProfilePatient = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  cpf: string | null;
  notes: string | null;
  photo_url: string | null;
  custom_fields: Record<string, unknown>;
  created_at: string;
};

export type CustomFieldDef = {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
};

export type TimelineItem = {
  id: string;
  type: "event" | "appointment" | "payment" | "comanda";
  date: string;
  title: string;
  subtitle?: string;
  href?: string;
};

export type FormInstanceItem = {
  id: string;
  status: string;
  template_name: string;
  appointment_id: string | null;
  scheduled_at: string | null;
  created_at: string;
};

export type ClinicalDocItem = {
  id: string;
  type: "prescription" | "exam_request";
  title: string | null;
  status: string;
  created_at: string;
  appointment_id: string | null;
  doctor_name: string | null;
};

export type RecommendationItem = {
  appointment_id: string;
  scheduled_at: string;
  recommendations: string;
  procedure_names: string[];
};

export type PatientProfileBundle = {
  patient: PatientProfilePatient;
  customFields: CustomFieldDef[];
  timeline: TimelineItem[];
  consultations: {
    id: string;
    scheduled_at: string;
    status: string;
    professional_name: string | null;
    appointment_type_name: string | null;
    procedure_names: string[];
    valor: number | null;
    notes: string | null;
  }[];
  payments: {
    id: string;
    amount: number;
    paid_at: string;
    payment_method: string | null;
  }[];
  comandas: {
    id: string;
    total_amount: number;
    paid_amount: number;
    status: string;
    created_at: string;
  }[];
  forms: FormInstanceItem[];
  clinicalDocuments: ClinicalDocItem[];
  recommendations: RecommendationItem[];
  financial: {
    totalPaid: number;
    totalDue: number;
    totalBilled: number;
  };
};

export function calcPatientAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
