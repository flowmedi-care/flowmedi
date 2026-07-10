export type AppointmentSlot = {
  start: string;
  end: string;
  professionalId: string | null;
};

export function appointmentSlot(
  start: string,
  end: string,
  professionalId: string | null = null
): AppointmentSlot {
  return { start, end, professionalId };
}
