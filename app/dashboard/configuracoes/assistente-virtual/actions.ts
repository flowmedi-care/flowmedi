"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseVirtualAssistant } from "@/lib/plan-gates";
import { updateClinicInfo } from "../actions";
import type {
  DayKey,
  OperatingHours,
  VirtualAssistantFaq,
  VirtualAssistantLocation,
  VirtualAssistantSettings,
} from "@/lib/virtual-assistant/types";

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
    return { error: "Apenas administradores.", supabase: null, clinicId: null };
  }

  return { error: null, supabase, clinicId: profile.clinic_id };
}

export async function getVirtualAssistantPageData() {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  const [settingsRes, faqRes, locRes, clinicRes] = await Promise.all([
    ctx.supabase
      .from("clinic_virtual_assistant_settings")
      .select("*")
      .eq("clinic_id", ctx.clinicId)
      .maybeSingle(),
    ctx.supabase
      .from("clinic_virtual_assistant_faq")
      .select("*")
      .eq("clinic_id", ctx.clinicId)
      .order("display_order"),
    ctx.supabase
      .from("clinic_virtual_assistant_locations")
      .select("*")
      .eq("clinic_id", ctx.clinicId)
      .order("display_order"),
    ctx.supabase
      .from("clinics")
      .select(
        "name, phone, email, address, whatsapp_url, facebook_url, instagram_url, auto_message_send_start, auto_message_send_end"
      )
      .eq("id", ctx.clinicId)
      .single(),
  ]);

  const planData = await getClinicPlanData();
  const canUse = Boolean(
    planData &&
      canUseVirtualAssistant(planData.limits, planData.planSlug, planData.subscriptionStatus)
  );

  return {
    error: null,
    clinicId: ctx.clinicId,
    canUse,
    settings: settingsRes.data as VirtualAssistantSettings | null,
    faq: (faqRes.data ?? []) as VirtualAssistantFaq[],
    locations: (locRes.data ?? []) as VirtualAssistantLocation[],
    clinic: clinicRes.data,
  };
}

export type SaveVirtualAssistantInput = {
  enabled?: boolean;
  assistant_name?: string | null;
  tone?: "formal" | "informal";
  use_emojis?: boolean;
  segment?: string | null;
  short_description?: string | null;
  google_maps_url?: string | null;
  parking_info?: string | null;
  accessibility_info?: string | null;
  landmarks?: string | null;
  has_multiple_units?: boolean;
  human_handoff_enabled?: boolean;
  message_debounce_seconds?: number;
  operating_hours?: OperatingHours;
  holiday_policy?: string | null;
  payment_methods?: string[];
  cancellation_policy?: string | null;
  avg_wait_time?: string | null;
  delivery_info?: string | null;
  booking_requires_appointment?: boolean;
  website_url?: string | null;
  active_promotions?: string | null;
  ai_model?: string;
  max_context_messages?: number;
  bot_active_start?: string | null;
  bot_active_end?: string | null;
  clinic_contact?: {
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    whatsapp_url?: string | null;
    facebook_url?: string | null;
    instagram_url?: string | null;
  };
};

export async function saveVirtualAssistantSettings(input: SaveVirtualAssistantInput) {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  if (input.enabled) {
    const planData = await getClinicPlanData();
    const allowed = Boolean(
      planData &&
        canUseVirtualAssistant(planData.limits, planData.planSlug, planData.subscriptionStatus)
    );
    if (!allowed) {
      return { error: "Assistente virtual disponível em planos com WhatsApp ativo." };
    }
  }

  if (input.clinic_contact) {
    const c = input.clinic_contact;
    const clinicResult = await updateClinicInfo({
      phone: c.phone ?? null,
      email: c.email ?? null,
      address: c.address ?? null,
      whatsapp_url: c.whatsapp_url ?? null,
      facebook_url: c.facebook_url ?? null,
      instagram_url: c.instagram_url ?? null,
    });
    if (clinicResult.error) return { error: clinicResult.error };
  }

  const row: Record<string, unknown> = {
    clinic_id: ctx.clinicId,
    updated_at: new Date().toISOString(),
  };

  const fields: (keyof SaveVirtualAssistantInput)[] = [
    "enabled",
    "assistant_name",
    "tone",
    "use_emojis",
    "segment",
    "short_description",
    "google_maps_url",
    "parking_info",
    "accessibility_info",
    "landmarks",
    "has_multiple_units",
    "human_handoff_enabled",
    "message_debounce_seconds",
    "operating_hours",
    "holiday_policy",
    "payment_methods",
    "cancellation_policy",
    "avg_wait_time",
    "delivery_info",
    "booking_requires_appointment",
    "website_url",
    "active_promotions",
    "ai_model",
    "max_context_messages",
    "bot_active_start",
    "bot_active_end",
  ];

  for (const key of fields) {
    if (input[key] !== undefined) row[key] = input[key];
  }

  const { error } = await ctx.supabase
    .from("clinic_virtual_assistant_settings")
    .upsert(row, { onConflict: "clinic_id" });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes/assistente-virtual");
  return { error: null };
}

export async function upsertVirtualAssistantFaq(
  id: string | null,
  question: string,
  answer: string,
  displayOrder: number
) {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  if (id) {
    const { error } = await ctx.supabase
      .from("clinic_virtual_assistant_faq")
      .update({ question, answer, display_order: displayOrder })
      .eq("id", id)
      .eq("clinic_id", ctx.clinicId);
    if (error) return { error: error.message };
  } else {
    const { error } = await ctx.supabase.from("clinic_virtual_assistant_faq").insert({
      clinic_id: ctx.clinicId,
      question,
      answer,
      display_order: displayOrder,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/configuracoes/assistente-virtual");
  revalidatePath("/dashboard/configuracoes/clinica");
  return { error: null };
}

export async function deleteVirtualAssistantFaq(id: string) {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from("clinic_virtual_assistant_faq")
    .delete()
    .eq("id", id)
    .eq("clinic_id", ctx.clinicId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes/assistente-virtual");
  return { error: null };
}

export async function upsertVirtualAssistantLocation(
  id: string | null,
  data: {
    name: string;
    address?: string | null;
    google_maps_url?: string | null;
    phone?: string | null;
    operating_hours?: OperatingHours;
    display_order: number;
  }
) {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  const payload = {
    clinic_id: ctx.clinicId,
    name: data.name,
    address: data.address ?? null,
    google_maps_url: data.google_maps_url ?? null,
    phone: data.phone ?? null,
    operating_hours: data.operating_hours ?? {},
    display_order: data.display_order,
  };

  if (id) {
    const { error } = await ctx.supabase
      .from("clinic_virtual_assistant_locations")
      .update(payload)
      .eq("id", id)
      .eq("clinic_id", ctx.clinicId);
    if (error) return { error: error.message };
  } else {
    const { error } = await ctx.supabase.from("clinic_virtual_assistant_locations").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/configuracoes/assistente-virtual");
  revalidatePath("/dashboard/configuracoes/clinica");
  return { error: null };
}

export async function deleteVirtualAssistantLocation(id: string) {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from("clinic_virtual_assistant_locations")
    .delete()
    .eq("id", id)
    .eq("clinic_id", ctx.clinicId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes/assistente-virtual");
  revalidatePath("/dashboard/configuracoes/clinica");
  return { error: null };
}

export async function saveOperatingHoursForDay(day: DayKey, hours: OperatingHours[DayKey]) {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  const { data: current } = await ctx.supabase
    .from("clinic_virtual_assistant_settings")
    .select("operating_hours")
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();

  const operating_hours = {
    ...((current?.operating_hours as OperatingHours) ?? {}),
    [day]: hours,
  };

  return saveVirtualAssistantSettings({ operating_hours });
}
