"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { OperatingHours } from "@/lib/virtual-assistant/types";

export type ClinicProfileUpdate = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  whatsapp_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  agenda_work_start?: string | null;
  agenda_work_end?: string | null;
  agenda_max_concurrent?: number | null;
  segment?: string | null;
  short_description?: string | null;
  mission?: string | null;
  vision?: string | null;
  values_text?: string | null;
  google_maps_url?: string | null;
  parking_info?: string | null;
  accessibility_info?: string | null;
  landmarks?: string | null;
  has_multiple_units?: boolean;
  operating_hours?: OperatingHours;
  holiday_policy?: string | null;
  website_url?: string | null;
};

async function requireAdminClinic() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", supabase: null, clinicId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem atualizar informações da clínica.", supabase: null, clinicId: null };
  }

  return { error: null, supabase, clinicId: profile.clinic_id };
}

const normalizeTime = (value: string): string | null => {
  const cleaned = String(value || "").trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
};

function revalidateClinicPaths() {
  revalidatePath("/dashboard/configuracoes/clinica");
  revalidatePath("/dashboard/configuracoes/assistente-virtual");
  revalidatePath("/dashboard/configuracoes/site");
  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard/mensagens/templates");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/c/[slug]", "page");
}

export async function updateClinicProfile(data: ClinicProfileUpdate): Promise<{ error: string | null }> {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  const clinicUpdate: Record<string, unknown> = {};
  if (data.name !== undefined) clinicUpdate.name = data.name;
  if (data.phone !== undefined) clinicUpdate.phone = data.phone;
  if (data.email !== undefined) clinicUpdate.email = data.email;
  if (data.address !== undefined) clinicUpdate.address = data.address;
  if (data.whatsapp_url !== undefined) clinicUpdate.whatsapp_url = data.whatsapp_url?.trim() || null;
  if (data.facebook_url !== undefined) clinicUpdate.facebook_url = data.facebook_url?.trim() || null;
  if (data.instagram_url !== undefined) clinicUpdate.instagram_url = data.instagram_url?.trim() || null;

  const startInput = data.agenda_work_start !== undefined ? data.agenda_work_start : undefined;
  const endInput = data.agenda_work_end !== undefined ? data.agenda_work_end : undefined;
  if (startInput !== undefined || endInput !== undefined) {
    const start = normalizeTime(startInput ?? "07:00");
    const end = normalizeTime(endInput ?? "20:00");
    if (!start || !end) {
      return { error: "Horários da agenda inválidos. Use o formato HH:mm." };
    }
    if (start > end) {
      return { error: "O início do expediente não pode ser maior que o final." };
    }
    clinicUpdate.agenda_work_start = start;
    clinicUpdate.agenda_work_end = end;
  }

  if (data.agenda_max_concurrent !== undefined) {
    const raw = data.agenda_max_concurrent;
    if (raw === null || raw <= 1) {
      clinicUpdate.agenda_max_concurrent = null;
    } else if (!Number.isInteger(raw) || raw < 2 || raw > 20) {
      return { error: "Consultórios simultâneos deve ser entre 2 e 20, ou vazio para sem limite na clínica." };
    } else {
      clinicUpdate.agenda_max_concurrent = raw;
    }
  }

  if (Object.keys(clinicUpdate).length > 0) {
    const { error } = await ctx.supabase.from("clinics").update(clinicUpdate).eq("id", ctx.clinicId);
    if (error) return { error: error.message };
  }

  const vaFields: (keyof ClinicProfileUpdate)[] = [
    "segment",
    "short_description",
    "google_maps_url",
    "parking_info",
    "accessibility_info",
    "landmarks",
    "has_multiple_units",
    "operating_hours",
    "holiday_policy",
    "website_url",
  ];
  const hasVaUpdate = vaFields.some((key) => data[key] !== undefined);
  if (hasVaUpdate) {
    const vaRow: Record<string, unknown> = {
      clinic_id: ctx.clinicId,
      updated_at: new Date().toISOString(),
    };
    for (const key of vaFields) {
      if (data[key] !== undefined) vaRow[key] = data[key];
    }
    const { error } = await ctx.supabase
      .from("clinic_virtual_assistant_settings")
      .upsert(vaRow, { onConflict: "clinic_id" });
    if (error) return { error: error.message };
  }

  const siteFields: (keyof ClinicProfileUpdate)[] = ["mission", "vision", "values_text"];
  const hasSiteUpdate = siteFields.some((key) => data[key] !== undefined);
  if (hasSiteUpdate) {
    const siteRow: Record<string, unknown> = {
      clinic_id: ctx.clinicId,
      updated_at: new Date().toISOString(),
    };
    for (const key of siteFields) {
      if (data[key] !== undefined) siteRow[key] = data[key];
    }
    const { error } = await ctx.supabase
      .from("clinic_public_site_settings")
      .upsert(siteRow, { onConflict: "clinic_id" });
    if (error) return { error: error.message };
  }

  revalidateClinicPaths();
  return { error: null };
}
