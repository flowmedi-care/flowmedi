import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listRooms } from "@/app/dashboard/configuracoes/room-actions";

export type AgendaShell = {
  userId: string;
  clinicId: string;
  role: string;
  preferences: Record<string, unknown>;
  agendaStartHour: number;
  agendaEndHour: number;
  allowedDoctorIds: string[];
  initialPreferences: {
    viewMode: "timeline" | "calendar";
    timelineGranularity: "day" | "week" | "month";
    calendarGranularity: "week" | "month";
    statusFilter: string[];
    formFilter: "confirmados_sem_formulario" | "confirmados_com_formulario" | null;
    filterByServiceId: string;
    filterByDoctorId: string;
    filterByProcedureId: string;
    filterByRoomId: string;
    colorBy: "status" | "dimension";
    colorByDimensionId: string;
  };
};

function parseHour(value: string | null | undefined): number | null {
  if (!value) return null;
  const hour = Number.parseInt(value.split(":")[0] ?? "", 10);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

export async function loadAgendaShell(): Promise<AgendaShell> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, preferences, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const preferences = (profile.preferences as Record<string, unknown>) || {};
  const clinicId = profile.clinic_id;

  const { data: clinic } = await supabase
    .from("clinics")
    .select("agenda_work_start, agenda_work_end")
    .eq("id", clinicId)
    .single();

  const parsedStartHour = parseHour(clinic?.agenda_work_start);
  const parsedEndHour = parseHour(clinic?.agenda_work_end);
  const agendaStartHour =
    parsedStartHour !== null &&
    parsedEndHour !== null &&
    parsedStartHour <= parsedEndHour
      ? parsedStartHour
      : 7;
  const agendaEndHour =
    parsedStartHour !== null &&
    parsedEndHour !== null &&
    parsedStartHour <= parsedEndHour
      ? parsedEndHour
      : 20;

  let allowedDoctorIds: string[] = [];
  if (profile.role === "secretaria") {
    const { data: sd } = await supabase
      .from("secretary_doctors")
      .select("doctor_id")
      .eq("clinic_id", clinicId)
      .eq("secretary_id", user.id);
    allowedDoctorIds = (sd ?? []).map((r) => r.doctor_id);
  }

  return {
    userId: user.id,
    clinicId,
    role: profile.role ?? "secretaria",
    preferences,
    agendaStartHour,
    agendaEndHour,
    allowedDoctorIds,
    initialPreferences: {
      viewMode: (preferences.agenda_view_mode as "timeline" | "calendar") || "timeline",
      timelineGranularity:
        (preferences.agenda_timeline_granularity as "day" | "week" | "month") || "day",
      calendarGranularity:
        (preferences.agenda_calendar_granularity as "week" | "month") || "week",
      statusFilter: (preferences.agenda_status_filter as string[]) || [],
      formFilter:
        (preferences.agenda_form_filter as
          | "confirmados_sem_formulario"
          | "confirmados_com_formulario"
          | null) || null,
      filterByServiceId: (preferences.agenda_filter_by_service_id as string) || "",
      filterByDoctorId: (preferences.agenda_filter_by_doctor_id as string) || "",
      filterByProcedureId: (preferences.agenda_filter_by_procedure_id as string) || "",
      filterByRoomId: (preferences.agenda_filter_by_room_id as string) || "",
      colorBy: (preferences.agenda_color_by as "status" | "dimension") || "status",
      colorByDimensionId: (preferences.agenda_color_by_dimension_id as string) || "",
    },
  };
}

export async function loadAgendaCatalog(shell: AgendaShell) {
  const supabase = await createClient();
  const { clinicId, userId, role, allowedDoctorIds } = shell;

  const [
    { data: patients },
    { data: doctorsRaw },
    { rooms: roomsList },
    { data: procedures },
    { data: formTemplates },
    { data: services },
    { data: servicePrices },
    { data: pricingDimensions },
    { data: pricingDimensionValuesRaw },
    { data: profileColorOverridesData },
    { data: doctorProcedures },
    scheduleBlocksResult,
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("id, full_name, email")
      .eq("clinic_id", clinicId)
      .order("full_name"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", clinicId)
      .eq("role", "medico")
      .order("full_name"),
    listRooms(true),
    supabase
      .from("procedures")
      .select("id, name, recommendations, default_service_id, duration_minutes")
      .eq("clinic_id", clinicId)
      .order("display_order", { ascending: true }),
    supabase
      .from("form_templates")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .order("name"),
    supabase.from("services").select("id, nome").eq("clinic_id", clinicId).order("nome"),
    supabase
      .from("service_prices")
      .select("service_id, professional_id")
      .eq("clinic_id", clinicId)
      .eq("ativo", true),
    supabase
      .from("price_dimensions")
      .select("id, nome")
      .eq("clinic_id", clinicId)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("dimension_values")
      .select("id, dimension_id, nome, cor")
      .eq("clinic_id", clinicId)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("profile_dimension_value_colors")
      .select("dimension_value_id, cor")
      .eq("profile_id", userId),
    supabase
      .from("doctor_procedures")
      .select("doctor_id, procedure_id")
      .eq("clinic_id", clinicId),
    loadScheduleBlocks(supabase, shell),
  ]);

  let doctors = doctorsRaw ?? [];
  if (role === "secretaria" && allowedDoctorIds.length > 0) {
    doctors = doctors.filter((d) => allowedDoctorIds.includes(d.id));
  } else if (role === "medico") {
    doctors = doctors.filter((d) => d.id === userId);
  }

  const overrideMap: Record<string, string> = {};
  for (const row of profileColorOverridesData ?? []) {
    overrideMap[row.dimension_value_id] = row.cor;
  }

  const pricingDimensionValues = (pricingDimensionValuesRaw ?? []).map(
    (v: { id: string; dimension_id: string; nome: string; cor: string | null }) => ({
      id: v.id,
      dimension_id: v.dimension_id,
      nome: v.nome,
      cor: overrideMap[v.id] ?? v.cor ?? null,
    })
  );

  const roomNameById = new Map(roomsList.map((r) => [r.id, r.name] as const));
  const serviceNameById = new Map((services ?? []).map((s) => [s.id, s.nome] as const));

  return {
    patients: (patients ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email || undefined,
    })),
    doctors: doctors.map((d) => ({ id: d.id, full_name: d.full_name })),
    rooms: roomsList.map((r) => ({ id: r.id, name: r.name })),
    roomsRequired: roomsList.length > 0,
    procedures: (procedures ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      recommendations: p.recommendations ?? null,
      default_service_id: p.default_service_id ?? null,
      duration_minutes: p.duration_minutes ?? 30,
    })),
    formTemplates: (formTemplates ?? []).map((f) => ({ id: f.id, name: f.name })),
    services: (services ?? []).map((s) => ({ id: s.id, nome: s.nome })),
    pricingDimensions: (pricingDimensions ?? []).map((d) => ({ id: d.id, nome: d.nome })),
    pricingDimensionValues,
    servicePriceRules: (servicePrices ?? []).map((sp) => ({
      serviceId: String((sp as { service_id?: unknown }).service_id ?? ""),
      professionalId:
        (sp as { professional_id?: unknown }).professional_id != null
          ? String((sp as { professional_id?: unknown }).professional_id)
          : null,
    })),
    doctorProcedures: (doctorProcedures ?? []).map((dp) => ({
      doctorId: String((dp as { doctor_id?: unknown }).doctor_id ?? ""),
      procedureId: String((dp as { procedure_id?: unknown }).procedure_id ?? ""),
    })),
    scheduleBlocks: scheduleBlocksResult,
    roomNameById,
    serviceNameById,
  };
}

async function loadScheduleBlocks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shell: AgendaShell
) {
  let scheduleBlocksQuery = supabase
    .from("schedule_blocks")
    .select("*")
    .eq("clinic_id", shell.clinicId)
    .order("created_at", { ascending: false });

  if (shell.role === "medico") {
    scheduleBlocksQuery = scheduleBlocksQuery.eq("doctor_id", shell.userId);
  } else if (shell.role === "secretaria" && shell.allowedDoctorIds.length > 0) {
    const ids = shell.allowedDoctorIds.join(",");
    scheduleBlocksQuery = scheduleBlocksQuery.or(`doctor_id.is.null,doctor_id.in.(${ids})`);
  }

  const { data } = await scheduleBlocksQuery;
  return data ?? [];
}

export async function loadAgendaAppointments(
  shell: AgendaShell,
  catalog: Awaited<ReturnType<typeof loadAgendaCatalog>>
) {
  const supabase = await createClient();
  const { clinicId, userId, role, allowedDoctorIds } = shell;
  const { roomNameById, serviceNameById } = catalog;

  const now = new Date();
  const startRange = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endRange = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59, 999);

  let appointmentsQuery = supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      scheduled_end_at,
      room_id,
      status,
      notes,
      service_id,
      valor,
      patient:patients ( id, full_name ),
      doctor:profiles!doctor_id ( id, full_name ),
      appointment_type:appointment_types ( id, name ),
      procedure:procedures!procedure_id ( id, name ),
      form_instances:form_instances ( id, status )
    `
    )
    .eq("clinic_id", clinicId)
    .neq("status", "cancelada")
    .gte("scheduled_at", startRange.toISOString())
    .lte("scheduled_at", endRange.toISOString())
    .order("scheduled_at");

  if (role === "medico") {
    appointmentsQuery = appointmentsQuery.eq("doctor_id", userId);
  } else if (role === "secretaria" && allowedDoctorIds.length > 0) {
    appointmentsQuery = appointmentsQuery.in("doctor_id", allowedDoctorIds);
  }

  const { data: appointments, error: appointmentsError } = await appointmentsQuery;
  const appointmentIds = (appointments ?? []).map((a: { id: string }) => a.id);

  let appointmentDimensionValues: { appointment_id: string; dimension_value_id: string }[] = [];
  if (appointmentIds.length > 0) {
    const { data: adv } = await supabase
      .from("appointment_dimension_values")
      .select("appointment_id, dimension_value_id")
      .in("appointment_id", appointmentIds);
    appointmentDimensionValues = adv ?? [];
  }

  const dimensionValueIdsByAppointment: Record<string, string[]> = {};
  for (const row of appointmentDimensionValues) {
    if (!dimensionValueIdsByAppointment[row.appointment_id]) {
      dimensionValueIdsByAppointment[row.appointment_id] = [];
    }
    dimensionValueIdsByAppointment[row.appointment_id].push(row.dimension_value_id);
  }

  const { loadAppointmentProcedures } = await import("@/lib/appointment-procedures");

  const proceduresByAppointment = new Map<string, { id: string; name: string }[]>();
  if (appointmentIds.length > 0) {
    await Promise.all(
      (appointments ?? []).map(async (a: Record<string, unknown>) => {
        const apptId = String(a.id ?? "");
        const legacyProc = Array.isArray(a.procedure) ? a.procedure[0] : a.procedure;
        const procs = await loadAppointmentProcedures(
          supabase,
          apptId,
          legacyProc as Parameters<typeof loadAppointmentProcedures>[2]
        );
        proceduresByAppointment.set(apptId, procs);
      })
    );
  }

  const rows = (appointments ?? []).map((a: Record<string, unknown>) => {
    const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
    const doctor = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
    const appointmentType = Array.isArray(a.appointment_type)
      ? a.appointment_type[0]
      : a.appointment_type;
    const procedure = Array.isArray(a.procedure) ? a.procedure[0] : a.procedure;
    const appointmentId = String(a.id ?? "");
    const proceduresList = proceduresByAppointment.get(appointmentId) ?? [];
    const formInstances = Array.isArray(a.form_instances) ? a.form_instances : [];
    const valorNum = a.valor != null ? Number(a.valor) : null;
    const svcId = a.service_id != null ? String(a.service_id) : null;
    return {
      id: appointmentId,
      scheduled_at: String(a.scheduled_at ?? ""),
      scheduled_end_at: a.scheduled_end_at != null ? String(a.scheduled_end_at) : null,
      room_id: a.room_id != null ? String(a.room_id) : null,
      room_name: a.room_id != null ? roomNameById.get(String(a.room_id)) ?? null : null,
      status: String(a.status ?? ""),
      notes: a.notes != null ? String(a.notes) : null,
      service_id: svcId,
      valor: valorNum,
      service_name: svcId ? serviceNameById.get(svcId) ?? null : null,
      dimension_value_ids: dimensionValueIdsByAppointment[appointmentId] ?? [],
      patient: {
        id: String((patient as { id?: unknown })?.id ?? ""),
        full_name: String((patient as { full_name?: unknown })?.full_name ?? ""),
      },
      doctor: {
        id: String((doctor as { id?: unknown })?.id ?? ""),
        full_name:
          (doctor as { full_name?: unknown })?.full_name != null
            ? String((doctor as { full_name?: unknown }).full_name)
            : null,
      },
      appointment_type: appointmentType
        ? {
            id: String((appointmentType as { id?: unknown })?.id ?? ""),
            name: String((appointmentType as { name?: unknown })?.name ?? ""),
          }
        : null,
      procedure: procedure
        ? {
            id: String((procedure as { id?: unknown })?.id ?? ""),
            name: String((procedure as { name?: unknown })?.name ?? ""),
          }
        : null,
      procedures: proceduresList.length
        ? proceduresList
        : procedure
          ? [
              {
                id: String((procedure as { id?: unknown })?.id ?? ""),
                name: String((procedure as { name?: unknown })?.name ?? ""),
              },
            ]
          : [],
      form_instances: formInstances.map((fi: { id?: unknown; status?: unknown }) => ({
        id: String(fi?.id ?? ""),
        status: String(fi?.status ?? ""),
      })),
    };
  });

  return { rows, appointmentsError };
}

