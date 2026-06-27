export type ProfessionalProfileMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  active: boolean | null;
  created_at: string | null;
  logo_url: string | null;
  logo_scale: number | null;
  cpf: string | null;
  crm: string | null;
  crm_uf: string | null;
  specialty: string | null;
  preferences: Record<string, unknown> | null;
};

export type ProfessionalProcedureItem = {
  id: string;
  name: string;
};

export type ProfessionalSecretaryItem = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type ProfessionalAppointmentItem = {
  id: string;
  scheduled_at: string;
  status: string;
  patient_name: string | null;
  procedure_name: string | null;
};

export type ProfessionalProfileBundle = {
  professional: ProfessionalProfileMember;
  procedures: ProfessionalProcedureItem[];
  secretaries: ProfessionalSecretaryItem[];
  recentAppointments: ProfessionalAppointmentItem[];
  referralMessage: string | null;
  agendaColorCount: number;
};
