"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  checkBlockAgainstAppointments,
  expandBlockOccurrences,
  rowToScheduleBlockInput,
  scheduleBlockInputToDbRow,
  validateScheduleBlockInput,
  type ScheduleBlockInput,
  type ScheduleBlockRow,
} from "@/lib/schedule-blocks";

export type ScheduleBlockListItem = ScheduleBlockRow & {
  doctor_name: string | null;
};

type AuthContext = {
  userId: string;
  clinicId: string;
  role: string;
  allowedDoctorIds: string[];
};

async function getAuthContext(): Promise<
  { ok: true; ctx: AuthContext } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { ok: false, error: "Clínica não encontrada." };

  let allowedDoctorIds: string[] = [];
  if (profile.role === "secretaria") {
    const { data: sd } = await supabase
      .from("secretary_doctors")
      .select("doctor_id")
      .eq("clinic_id", profile.clinic_id)
      .eq("secretary_id", user.id);
    allowedDoctorIds = (sd ?? []).map((r) => r.doctor_id);
  }

  return {
    ok: true,
    ctx: {
      userId: user.id,
      clinicId: profile.clinic_id,
      role: profile.role,
      allowedDoctorIds,
    },
  };
}

function canManageBlockScope(
  ctx: AuthContext,
  doctorId: string | null
): boolean {
  if (ctx.role === "admin") return true;
  if (ctx.role === "medico") {
    return doctorId === ctx.userId;
  }
  if (ctx.role === "secretaria") {
    if (!doctorId) return true;
    if (ctx.allowedDoctorIds.length === 0) return true;
    return ctx.allowedDoctorIds.includes(doctorId);
  }
  return false;
}

async function loadBlockForEdit(
  blockId: string,
  clinicId: string
): Promise<{ block: ScheduleBlockRow | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_blocks")
    .select("*")
    .eq("id", blockId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) {
    if (error.message.includes("schedule_blocks")) {
      return { block: null, error: "Execute a migration de períodos indisponíveis no banco." };
    }
    return { block: null, error: error.message };
  }
  if (!data) return { block: null, error: "Bloqueio não encontrado." };
  return { block: data as ScheduleBlockRow, error: null };
}

export async function listScheduleBlocks(input?: {
  rangeStart?: string;
  rangeEnd?: string;
}): Promise<{ data: ScheduleBlockListItem[]; error: string | null }> {
  const auth = await getAuthContext();
  if (!auth.ok) return { data: [], error: auth.error };
  const { ctx } = auth;

  const supabase = await createClient();
  let query = supabase
    .from("schedule_blocks")
    .select("*")
    .eq("clinic_id", ctx.clinicId)
    .order("created_at", { ascending: false });

  if (ctx.role === "medico") {
    query = query.eq("doctor_id", ctx.userId);
  } else if (ctx.role === "secretaria" && ctx.allowedDoctorIds.length > 0) {
    const ids = ctx.allowedDoctorIds.join(",");
    query = query.or(`doctor_id.is.null,doctor_id.in.(${ids})`);
  }

  const { data, error } = await query;
  if (error) {
    if (error.message.includes("schedule_blocks")) {
      return { data: [], error: null };
    }
    return { data: [], error: error.message };
  }

  const rangeStart = input?.rangeStart ? new Date(input.rangeStart) : null;
  const rangeEnd = input?.rangeEnd ? new Date(input.rangeEnd) : null;

  const doctorIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.doctor_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const doctorNameById = new Map<string, string>();
  if (doctorIds.length > 0) {
    const { data: doctors } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", doctorIds);
    for (const d of doctors ?? []) {
      doctorNameById.set(d.id, d.full_name ?? "");
    }
  }

  const items: ScheduleBlockListItem[] = (data ?? []).map((row) => ({
    ...(row as ScheduleBlockRow),
    doctor_name: row.doctor_id ? doctorNameById.get(row.doctor_id) ?? null : null,
  }));

  if (!rangeStart || !rangeEnd) {
    return { data: items, error: null };
  }

  const filtered = items.filter((block) => {
    const occurrences = expandBlockOccurrences(block, rangeStart, rangeEnd);
    return occurrences.length > 0;
  });

  return { data: filtered, error: null };
}

export async function getScheduleBlockForEdit(blockId: string): Promise<{
  data: ScheduleBlockInput | null;
  meta: { id: string; doctorName: string | null } | null;
  error: string | null;
}> {
  const auth = await getAuthContext();
  if (!auth.ok) return { data: null, meta: null, error: auth.error };

  const { block, error } = await loadBlockForEdit(blockId, auth.ctx.clinicId);
  if (error || !block) return { data: null, meta: null, error: error ?? "Não encontrado." };

  if (!canManageBlockScope(auth.ctx, block.doctor_id)) {
    return { data: null, meta: null, error: "Sem permissão." };
  }

  const supabase = await createClient();
  let doctorName: string | null = null;
  if (block.doctor_id) {
    const { data: doctor } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", block.doctor_id)
      .single();
    doctorName = (doctor?.full_name as string | undefined) ?? null;
  }

  return {
    data: rowToScheduleBlockInput(block),
    meta: { id: block.id, doctorName },
    error: null,
  };
}

export async function createScheduleBlock(
  input: ScheduleBlockInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  const auth = await getAuthContext();
  if (!auth.ok) return { data: null, error: auth.error };
  const { ctx } = auth;

  if (!canManageBlockScope(ctx, input.doctorId)) {
    return { data: null, error: "Sem permissão para este escopo." };
  }
  if (ctx.role === "medico" && !input.doctorId) {
    return { data: null, error: "Médicos só podem bloquear a própria agenda." };
  }

  const validationError = validateScheduleBlockInput(input);
  if (validationError) return { data: null, error: validationError };

  const supabase = await createClient();
  const apptConflict = await checkBlockAgainstAppointments(supabase, {
    clinicId: ctx.clinicId,
    block: input,
  });
  if (apptConflict) return { data: null, error: apptConflict };

  const row = scheduleBlockInputToDbRow(ctx.clinicId, input, ctx.userId);
  const { data, error } = await supabase
    .from("schedule_blocks")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("schedule_blocks")) {
      return {
        data: null,
        error: "Tabela de períodos indisponíveis não encontrada. Execute a migration no Supabase.",
      };
    }
    return { data: null, error: error.message };
  }

  revalidatePath("/dashboard/agenda");
  return { data: { id: data.id }, error: null };
}

export async function updateScheduleBlock(
  blockId: string,
  input: ScheduleBlockInput
): Promise<{ error: string | null }> {
  const auth = await getAuthContext();
  if (!auth.ok) return { error: auth.error };

  const { block, error: loadError } = await loadBlockForEdit(blockId, auth.ctx.clinicId);
  if (loadError || !block) return { error: loadError ?? "Não encontrado." };

  if (!canManageBlockScope(auth.ctx, block.doctor_id)) {
    return { error: "Sem permissão." };
  }
  if (!canManageBlockScope(auth.ctx, input.doctorId)) {
    return { error: "Sem permissão para o novo escopo." };
  }
  if (auth.ctx.role === "medico" && !input.doctorId) {
    return { error: "Médicos só podem bloquear a própria agenda." };
  }

  const validationError = validateScheduleBlockInput(input);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const apptConflict = await checkBlockAgainstAppointments(supabase, {
    clinicId: auth.ctx.clinicId,
    block: input,
    excludeBlockId: blockId,
  });
  if (apptConflict) return { error: apptConflict };

  const row = scheduleBlockInputToDbRow(auth.ctx.clinicId, input, auth.ctx.userId);
  delete row.created_by;

  const { error } = await supabase
    .from("schedule_blocks")
    .update(row)
    .eq("id", blockId)
    .eq("clinic_id", auth.ctx.clinicId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/agenda");
  return { error: null };
}

export async function deleteScheduleBlock(
  blockId: string
): Promise<{ error: string | null }> {
  const auth = await getAuthContext();
  if (!auth.ok) return { error: auth.error };

  const { block, error: loadError } = await loadBlockForEdit(blockId, auth.ctx.clinicId);
  if (loadError || !block) return { error: loadError ?? "Não encontrado." };

  if (!canManageBlockScope(auth.ctx, block.doctor_id)) {
    return { error: "Sem permissão." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_blocks")
    .delete()
    .eq("id", blockId)
    .eq("clinic_id", auth.ctx.clinicId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/agenda");
  return { error: null };
}
