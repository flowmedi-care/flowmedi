export type PatientRef = {
  id: string;
};

export function patientRef(id: string): PatientRef {
  return { id };
}
