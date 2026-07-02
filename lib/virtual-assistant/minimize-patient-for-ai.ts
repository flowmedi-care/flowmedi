/** Reduz dados de paciente enviados ao provedor de IA (minimização — LGPD art. 6º, III). */

export type PatientRowForAi = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
};

export function minimizePatientForAiToolResult(
  patient: PatientRowForAi | null
): Record<string, unknown> {
  if (!patient) return { found: false };
  const firstName = patient.full_name.trim().split(/\s+/)[0] || patient.full_name;
  return {
    found: true,
    patient_id: patient.id,
    display_name: firstName,
  };
}

export function minimizePatientListForAi(
  patients: PatientRowForAi[]
): Record<string, unknown>[] {
  return patients.map((p) => minimizePatientForAiToolResult(p));
}
