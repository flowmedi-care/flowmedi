import type { PublicClinicSite } from "./types";

export type BookingReadiness = {
  available: boolean;
  reason: string | null;
};

export function checkPublicBookingReadiness(site: PublicClinicSite): BookingReadiness {
  if (!site.site.self_service_booking_enabled) {
    return { available: false, reason: "Autoagendamento desativado pela clínica." };
  }

  if (site.has_active_rooms) {
    return {
      available: false,
      reason: "Esta clínica exige seleção de sala. Entre em contato para agendar.",
    };
  }

  if (site.procedures.length === 0) {
    return {
      available: false,
      reason: "Nenhum procedimento disponível para agendamento online.",
    };
  }

  if (site.doctors.length === 0) {
    return {
      available: false,
      reason: "Nenhum profissional disponível para agendamento online.",
    };
  }

  return { available: true, reason: null };
}

export function filterDoctorsForProcedure(
  site: PublicClinicSite,
  procedureId: string
): PublicClinicSite["doctors"] {
  const procedure = site.procedures.find((p) => p.id === procedureId);
  if (!procedure) return [];

  if (procedure.doctor_ids.length === 0) {
    return site.doctors;
  }

  const idSet = new Set(procedure.doctor_ids);
  return site.doctors.filter((d) => idSet.has(d.id));
}

export function filterProceduresForDoctor(
  site: PublicClinicSite,
  doctorId: string
): PublicClinicSite["procedures"] {
  return site.procedures.filter((p) => {
    if (p.doctor_ids.length === 0) return true;
    return p.doctor_ids.includes(doctorId);
  });
}
