"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseCustomLogo, canUseWhatsApp } from "@/lib/plan-gates";

async function uploadLogoToStorage(file: File, path: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const arrayBuffer = await file.arrayBuffer();
  const { data, error } = await supabase.storage
    .from("logos")
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) return { error: error.message };

  const { data: { publicUrl } } = supabase.storage
    .from("logos")
    .getPublicUrl(path);

  return { url: publicUrl };
}

export async function uploadClinicLogo(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem fazer upload da logo da clínica." };
  }

  const planData = await getClinicPlanData();
  const logoAllowed = Boolean(
    planData &&
      canUseCustomLogo(planData.limits, planData.planSlug, planData.subscriptionStatus)
  );
  if (!logoAllowed) {
    return { error: "Logo personalizada disponível nos planos que incluem identidade visual." };
  }

  const file = formData.get("file") as File;
  if (!file) return { error: "Nenhum arquivo selecionado." };

  const path = `clinic-${profile.clinic_id}.${file.name.split(".").pop()}`;
  const uploadResult = await uploadLogoToStorage(file, path);

  if ("error" in uploadResult) {
    return uploadResult;
  }

  const { error } = await supabase
    .from("clinics")
    .update({ logo_url: uploadResult.url })
    .eq("id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  return { url: uploadResult.url };
}

export async function deleteClinicLogo() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem remover a logo da clínica." };
  }

  const planData = await getClinicPlanData();
  const logoAllowed = Boolean(
    planData &&
      canUseCustomLogo(planData.limits, planData.planSlug, planData.subscriptionStatus)
  );
  if (!logoAllowed) {
    return { error: "Logo personalizada disponível nos planos que incluem identidade visual." };
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("logo_url")
    .eq("id", profile.clinic_id)
    .single();

  if (clinic?.logo_url) {
    const path = clinic.logo_url.split("/logos/")[1];
    if (path) {
      await supabase.storage.from("logos").remove([path]);
    }
  }

  const { error } = await supabase
    .from("clinics")
    .update({ logo_url: null })
    .eq("id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}

export async function uploadDoctorLogo(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "medico") {
    return { error: "Apenas médicos podem fazer upload da sua logo." };
  }

  const file = formData.get("file") as File;
  if (!file) return { error: "Nenhum arquivo selecionado." };

  const path = `doctor-${user.id}.${file.name.split(".").pop()}`;
  const uploadResult = await uploadLogoToStorage(file, path);

  if ("error" in uploadResult) {
    return uploadResult;
  }

  // Usa função RPC para contornar problemas de RLS
  const { error } = await supabase.rpc("update_profile_logo_url", {
    p_user_id: user.id,
    p_logo_url: uploadResult.url,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/perfil");
  return { url: uploadResult.url };
}

export async function deleteDoctorLogo() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("logo_url")
    .eq("id", user.id)
    .single();

  if (profile?.logo_url) {
    const path = profile.logo_url.split("/logos/")[1];
    if (path) {
      await supabase.storage.from("logos").remove([path]);
    }
  }

  // Usa função RPC para contornar problemas de RLS
  const { error } = await supabase.rpc("update_profile_logo_url", {
    p_user_id: user.id,
    p_logo_url: null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/perfil");
  return { error: null };
}

export async function updateClinicLogoScale(scale: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem ajustar a escala da logo da clínica." };
  }

  const planData = await getClinicPlanData();
  const logoAllowed = Boolean(
    planData &&
      canUseCustomLogo(planData.limits, planData.planSlug, planData.subscriptionStatus)
  );
  if (!logoAllowed) {
    return { error: "Logo personalizada disponível nos planos que incluem identidade visual." };
  }

  // Validar escala
  if (scale < 50 || scale > 200) {
    return { error: "A escala deve estar entre 50% e 200%." };
  }

  const { error } = await supabase
    .from("clinics")
    .update({ logo_scale: scale })
    .eq("id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}

export async function updateDoctorLogoScale(scale: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  // Validar escala
  if (scale < 50 || scale > 200) {
    return { error: "A escala deve estar entre 50% e 200%." };
  }

  // Usa função RPC para contornar problemas de RLS
  const { error } = await supabase.rpc("update_profile_logo_scale", {
    p_user_id: user.id,
    p_logo_scale: scale,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/perfil");
  return { error: null };
}

export async function createAppointmentType(name: string, duration_minutes: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id || profile.role !== "admin") {
    return { error: "Apenas administradores podem criar tipos de consulta." };
  }

  const { error } = await supabase.from("appointment_types").insert({
    clinic_id: profile.clinic_id,
    name: name.trim(),
    duration_minutes: duration_minutes || 30,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}

export async function updateAppointmentType(
  id: string,
  data: { name: string; duration_minutes: number }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Não autorizado." };

  const { error } = await supabase
    .from("appointment_types")
    .update({
      name: data.name.trim(),
      duration_minutes: data.duration_minutes || 30,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}

export async function deleteAppointmentType(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Não autorizado." };

  const { error } = await supabase.from("appointment_types").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}

export async function updateComplianceConfirmationDays(days: number | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem atualizar as configurações de compliance." };
  }

  // Validar valor: null (desabilitado) ou número entre 0 e 30
  if (days !== null && (days < 0 || days > 30)) {
    return { error: "O número de dias deve estar entre 0 e 30, ou deixe vazio para desabilitar." };
  }

  const { error } = await supabase
    .from("clinics")
    .update({ compliance_confirmation_days: days })
    .eq("id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateComplianceFormDays(days: number | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem atualizar as configurações de compliance." };
  }

  if (days !== null && (days < 0 || days > 30)) {
    return { error: "O número de dias deve estar entre 0 e 30, ou deixe vazio para desabilitar." };
  }

  const { error } = await supabase
    .from("clinics")
    .update({ compliance_form_days: days })
    .eq("id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateWhatsAppOperationalControls(input: {
  monthlyPost24hLimit: number | null;
  autoMessageSendStart: string;
  autoMessageSendEnd: string;
  autoMessageTimezone: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem atualizar configurações operacionais do WhatsApp." };
  }

  const planData = await getClinicPlanData();
  const whatsappAllowed = Boolean(
    planData && canUseWhatsApp(planData.planSlug, planData.subscriptionStatus)
  );
  if (!whatsappAllowed) {
    return { error: "Esse recurso é liberado nos planos com WhatsApp." };
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

  const start = normalizeTime(input.autoMessageSendStart);
  const end = normalizeTime(input.autoMessageSendEnd);
  if (!start || !end) {
    return { error: "Horários inválidos. Use o formato HH:mm." };
  }

  const timezone = (input.autoMessageTimezone || "").trim() || "America/Sao_Paulo";
  try {
    Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format(new Date());
  } catch {
    return { error: "Fuso horário inválido. Ex.: America/Sao_Paulo" };
  }

  const monthlyLimit =
    input.monthlyPost24hLimit === null
      ? null
      : Number.isFinite(input.monthlyPost24hLimit) && input.monthlyPost24hLimit >= 0
        ? Math.trunc(input.monthlyPost24hLimit)
        : NaN;

  if (Number.isNaN(monthlyLimit)) {
    return { error: "Limite mensal inválido. Use número maior ou igual a 0, ou deixe vazio." };
  }

  const { error } = await supabase
    .from("clinics")
    .update({
      whatsapp_monthly_post24h_limit: monthlyLimit,
      auto_message_send_start: start,
      auto_message_send_end: end,
      auto_message_timezone: timezone,
    })
    .eq("id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard/whatsapp");
  return { error: null };
}

export async function updateClinicServicesPricingMode(
  mode: "centralizado" | "descentralizado"
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem atualizar o modo de serviços e valores." };
  }

  if (mode !== "centralizado" && mode !== "descentralizado") {
    return { error: "Modo inválido." };
  }

  const { error } = await supabase
    .from("clinics")
    .update({ services_pricing_mode: mode })
    .eq("id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard/servicos-valores");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateClinicInfo(data: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  whatsapp_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem atualizar informações da clínica." };
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.whatsapp_url !== undefined) updateData.whatsapp_url = data.whatsapp_url?.trim() || null;
  if (data.facebook_url !== undefined) updateData.facebook_url = data.facebook_url?.trim() || null;
  if (data.instagram_url !== undefined) updateData.instagram_url = data.instagram_url?.trim() || null;

  const { error } = await supabase
    .from("clinics")
    .update(updateData)
    .eq("id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard/mensagens/templates");
  return { error: null };
}

export async function upsertClinicReportGoals(input: {
  targetConfirmationPct: number;
  targetAttendancePct: number;
  targetNoShowPct: number;
  targetOccupancyPct: number;
  targetReturnPct: number;
  returnWindowDays: number;
  workingHoursStart: number;
  workingHoursEnd: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem atualizar metas de relatórios." };
  }

  const inRange = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;
  if (!inRange(input.targetConfirmationPct, 0, 100)) return { error: "Meta de confirmação inválida (0-100)." };
  if (!inRange(input.targetAttendancePct, 0, 100)) return { error: "Meta de comparecimento inválida (0-100)." };
  if (!inRange(input.targetNoShowPct, 0, 100)) return { error: "Meta de no-show inválida (0-100)." };
  if (!inRange(input.targetOccupancyPct, 0, 100)) return { error: "Meta de ocupação inválida (0-100)." };
  if (!inRange(input.targetReturnPct, 0, 100)) return { error: "Meta de retorno inválida (0-100)." };
  if (!inRange(input.returnWindowDays, 1, 180)) return { error: "Janela de retorno inválida (1-180)." };
  if (!inRange(input.workingHoursStart, 0, 23) || !inRange(input.workingHoursEnd, 0, 23)) {
    return { error: "Horário de trabalho inválido (0-23)." };
  }
  if (input.workingHoursStart > input.workingHoursEnd) {
    return { error: "O horário inicial não pode ser maior que o horário final." };
  }

  const { error } = await supabase
    .from("clinic_report_goals")
    .upsert(
      {
        clinic_id: profile.clinic_id,
        target_confirmation_pct: input.targetConfirmationPct,
        target_attendance_pct: input.targetAttendancePct,
        target_no_show_pct: input.targetNoShowPct,
        target_occupancy_pct: input.targetOccupancyPct,
        target_return_pct: input.targetReturnPct,
        return_window_days: input.returnWindowDays,
        working_hours_start: input.workingHoursStart,
        working_hours_end: input.workingHoursEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clinic_id" }
    );

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard");
  return { error: null };
}
