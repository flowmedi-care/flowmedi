"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  cancelComanda,
  type CancellationType,
} from "./encounter-actions";
import { updateAppointment } from "./actions";
import {
  hasStockBeenConsumed,
  releaseStockForAppointment,
} from "@/lib/clinic-operations";
import { resolveAppointmentPrice } from "./actions";

export type NoShowFeeMode = "none" | "fixed" | "percent_service" | "service";

export type AppointmentCancelPreview = {
  appointmentId: string;
  patientName: string;
  scheduledAt: string;
  appointmentStatus: string;
  comanda: {
    id: string;
    status: string;
    total_amount: number;
    paid_amount: number;
    issued_at: string | null;
  } | null;
  stockCommitted: boolean;
  stockConsumed: boolean;
  noShowFee: {
    mode: NoShowFeeMode;
    amount: number | null;
    percent: number | null;
    serviceId: string | null;
    resolvedAmount: number;
  };
};

export type ApplyStatusChangeInput = {
  appointmentId: string;
  targetStatus: "cancelada" | "falta";
  reason?: string;
  cancellationType?: CancellationType;
  applyNoShowFee?: boolean;
};

async function resolveNoShowFeeAmount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  appointmentId: string
): Promise<{
  mode: NoShowFeeMode;
  amount: number | null;
  percent: number | null;
  serviceId: string | null;
  resolvedAmount: number;
}> {
  const { data: clinic } = await supabase
    .from("clinics")
    .select(
      "no_show_fee_mode, no_show_fee_amount, no_show_fee_percent, no_show_service_id"
    )
    .eq("id", clinicId)
    .maybeSingle();

  const mode = (clinic?.no_show_fee_mode as NoShowFeeMode) ?? "none";
  const amount =
    clinic?.no_show_fee_amount != null ? Number(clinic.no_show_fee_amount) : null;
  const percent =
    clinic?.no_show_fee_percent != null ? Number(clinic.no_show_fee_percent) : null;
  const serviceId = clinic?.no_show_service_id
    ? String(clinic.no_show_service_id)
    : null;

  if (mode === "none") {
    return { mode, amount, percent, serviceId, resolvedAmount: 0 };
  }

  const { data: appt } = await supabase
    .from("appointments")
    .select("service_id, valor, doctor_id")
    .eq("id", appointmentId)
    .single();

  if (mode === "fixed" && amount != null && amount > 0) {
    return { mode, amount, percent, serviceId, resolvedAmount: amount };
  }

  if (mode === "percent_service" && percent != null && percent > 0 && appt) {
    let base = Number(appt.valor) || 0;
    const svcId = appt.service_id as string | null;
    if (svcId && appt.doctor_id) {
      const { data: dimRows } = await supabase
        .from("appointment_dimension_values")
        .select("dimension_value_id")
        .eq("appointment_id", appointmentId);
      const dimensionValueIds = (dimRows ?? []).map((r) => r.dimension_value_id as string);
      const priceRes = await resolveAppointmentPrice(
        svcId,
        appt.doctor_id as string,
        dimensionValueIds
      );
      base = priceRes.valor ?? base;
    }
    const fee = Number(((base * percent) / 100).toFixed(2));
    return { mode, amount, percent, serviceId, resolvedAmount: fee };
  }

  if (mode === "service" && serviceId && appt?.doctor_id) {
    const { data: dimRows } = await supabase
      .from("appointment_dimension_values")
      .select("dimension_value_id")
      .eq("appointment_id", appointmentId);
    const dimensionValueIds = (dimRows ?? []).map((r) => r.dimension_value_id as string);
    const priceRes = await resolveAppointmentPrice(
      serviceId,
      appt.doctor_id as string,
      dimensionValueIds
    );
    const fee = priceRes.valor ?? 0;
    return { mode, amount, percent, serviceId, resolvedAmount: fee };
  }

  return { mode, amount, percent, serviceId, resolvedAmount: 0 };
}

export async function getAppointmentCancelPreview(
  appointmentId: string
): Promise<{ error: string | null; data: AppointmentCancelPreview | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: null };

  const { data: appt } = await supabase
    .from("appointments")
    .select(
      "id, status, scheduled_at, patient_id, patients!patient_id(full_name)"
    )
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!appt) return { error: "Consulta não encontrada.", data: null };

  const patient = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients;

  const { data: comanda } = await supabase
    .from("comandas")
    .select("id, status, total_amount, paid_amount, issued_at")
    .eq("appointment_id", appointmentId)
    .neq("status", "cancelada")
    .maybeSingle();

  const consumed = await hasStockBeenConsumed(supabase, appointmentId);

  const { data: consumption } = await supabase
    .from("appointment_consumption_lines")
    .select("quantity")
    .eq("appointment_id", appointmentId)
    .gt("quantity", 0);

  const noShowFee = await resolveNoShowFeeAmount(
    supabase,
    profile.clinic_id,
    appointmentId
  );

  return {
    error: null,
    data: {
      appointmentId,
      patientName: (patient as { full_name?: string })?.full_name ?? "—",
      scheduledAt: String(appt.scheduled_at),
      appointmentStatus: String(appt.status),
      comanda: comanda
        ? {
            id: String(comanda.id),
            status: String(comanda.status),
            total_amount: Number(comanda.total_amount),
            paid_amount: Number(comanda.paid_amount),
            issued_at: comanda.issued_at ? String(comanda.issued_at) : null,
          }
        : null,
      stockCommitted: (consumption ?? []).length > 0 && !consumed,
      stockConsumed: consumed,
      noShowFee,
    },
  };
}

async function emitNoShowFeeComanda(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  userId: string,
  appointmentId: string,
  feeAmount: number
): Promise<{ error: string | null }> {
  if (feeAmount <= 0) return { error: "Taxa de falta não configurada ou zerada." };

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, patient_id")
    .eq("id", appointmentId)
    .single();
  if (!appt) return { error: "Consulta não encontrada." };

  const { ensureEncounter } = await import("@/lib/clinic-operations");
  const enc = await ensureEncounter(supabase, clinicId, appointmentId);
  if (!enc) return { error: "Erro ao preparar atendimento." };

  const issuedAt = new Date().toISOString();

  const { data: existing } = await supabase
    .from("comandas")
    .select("id")
    .eq("appointment_id", appointmentId)
    .neq("status", "cancelada")
    .maybeSingle();

  let comandaId: string;

  if (existing) {
    comandaId = String(existing.id);
    await supabase
      .from("comandas")
      .update({
        subtotal_amount: feeAmount,
        discount_amount: 0,
        total_amount: feeAmount,
        paid_amount: 0,
        status: "aberta",
        issued_at: issuedAt,
        charge_materials_separately: false,
        updated_at: issuedAt,
      })
      .eq("id", comandaId);
    await supabase.from("comanda_items").delete().eq("comanda_id", comandaId);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("comandas")
      .insert({
        clinic_id: clinicId,
        appointment_id: appointmentId,
        patient_id: appt.patient_id,
        encounter_id: enc.id,
        subtotal_amount: feeAmount,
        discount_amount: 0,
        total_amount: feeAmount,
        paid_amount: 0,
        status: "aberta",
        issued_at: issuedAt,
        charge_materials_separately: false,
        created_by: userId,
      })
      .select("id")
      .single();
    if (insErr || !inserted) return { error: insErr?.message ?? "Erro ao criar comanda." };
    comandaId = String(inserted.id);
  }

  await supabase.from("comanda_items").insert({
    comanda_id: comandaId,
    item_type: "service",
    description: "Taxa de falta (no-show)",
    quantity: 1,
    unit_price: feeAmount,
    total_price: feeAmount,
    reference_id: null,
  });

  await supabase
    .from("appointments")
    .update({ valor: feeAmount, updated_at: issuedAt })
    .eq("id", appointmentId);

  return { error: null };
}

export async function applyAppointmentStatusChange(
  input: ApplyStatusChangeInput
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
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  const previewRes = await getAppointmentCancelPreview(input.appointmentId);
  if (previewRes.error || !previewRes.data) {
    return { error: previewRes.error ?? "Erro ao carregar consulta." };
  }
  const preview = previewRes.data;

  if (preview.appointmentStatus === input.targetStatus) {
    return { error: null };
  }

  const comanda = preview.comanda;
  const paidAmount = comanda?.paid_amount ?? 0;

  if (input.targetStatus === "cancelada") {
    if (paidAmount > 0 && !input.cancellationType) {
      return {
        error: "Informe estorno, crédito ou perda para o valor já recebido.",
      };
    }
    if (comanda && comanda.status !== "cancelada") {
      const cancelRes = await cancelComanda(comanda.id, {
        reason: input.reason,
        cancellationType: input.cancellationType,
      });
      if (cancelRes.error) return { error: cancelRes.error };
    }
  }

  if (input.targetStatus === "falta") {
    if (input.applyNoShowFee && preview.noShowFee.resolvedAmount > 0) {
      if (paidAmount > 0 && !input.cancellationType) {
        return {
          error:
            "Há pagamento na comanda atual. Escolha estorno, crédito ou perda antes de aplicar a taxa de falta.",
        };
      }
      if (comanda && comanda.status !== "cancelada") {
        const cancelRes = await cancelComanda(comanda.id, {
          reason: input.reason ?? "Substituída por taxa de falta",
          cancellationType: input.cancellationType,
        });
        if (cancelRes.error) return { error: cancelRes.error };
      }
    } else {
      if (paidAmount > 0 && !input.cancellationType) {
        return {
          error: "Informe estorno, crédito ou perda para o valor já recebido.",
        };
      }
      if (comanda && comanda.status !== "cancelada") {
        const cancelRes = await cancelComanda(comanda.id, {
          reason: input.reason,
          cancellationType: input.cancellationType,
        });
        if (cancelRes.error) return { error: cancelRes.error };
      }
    }
  }

  const statusRes = await updateAppointment(input.appointmentId, {
    status: input.targetStatus,
  });
  if (statusRes.error) return { error: statusRes.error };

  if (
    input.targetStatus === "falta" &&
    input.applyNoShowFee &&
    preview.noShowFee.resolvedAmount > 0
  ) {
    const feeRes = await emitNoShowFeeComanda(
      supabase,
      profile.clinic_id,
      user.id,
      input.appointmentId,
      preview.noShowFee.resolvedAmount
    );
    if (feeRes.error) return { error: feeRes.error };
  } else if (!preview.stockConsumed && preview.stockCommitted) {
    try {
      await releaseStockForAppointment(
        supabase,
        profile.clinic_id,
        input.appointmentId,
        user.id
      );
    } catch (e) {
      console.error("[applyAppointmentStatusChange] stock release:", e);
    }
  }

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/financeiro");
  revalidatePath(`/dashboard/agenda/consulta/${input.appointmentId}`);
  revalidatePath(`/dashboard/agenda/atendimento/${input.appointmentId}`);

  return { error: null };
}

/** Cancelamento automático (assistente virtual) — sem wizard, sem taxa de falta. */
export async function cancelAppointmentOperational(
  appointmentId: string,
  patientId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, patient_id, clinic_id, status")
    .eq("id", appointmentId)
    .single();

  if (!appt || appt.patient_id !== patientId) {
    return { error: "Consulta não encontrada." };
  }
  if (appt.status === "cancelada") return { error: null };

  const { data: comanda } = await supabase
    .from("comandas")
    .select("id, paid_amount, status")
    .eq("appointment_id", appointmentId)
    .neq("status", "cancelada")
    .maybeSingle();

  if (comanda && Number(comanda.paid_amount) > 0) {
    return {
      error:
        "Consulta com pagamento registrado. Cancele pelo dashboard da clínica para definir estorno ou crédito.",
    };
  }

  if (comanda) {
    const cancelRes = await cancelComanda(String(comanda.id), {
      reason: "Cancelamento via assistente virtual",
    });
    if (cancelRes.error) return { error: cancelRes.error };
  }

  return applyAppointmentStatusChange({
    appointmentId,
    targetStatus: "cancelada",
    reason: "Cancelamento via assistente virtual",
  });
}

export async function getClinicNoShowFeeSettings(): Promise<{
  error: string | null;
  data: {
    mode: NoShowFeeMode;
    amount: number | null;
    percent: number | null;
    serviceId: string | null;
  } | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: null };

  const { data: clinic } = await supabase
    .from("clinics")
    .select(
      "no_show_fee_mode, no_show_fee_amount, no_show_fee_percent, no_show_service_id"
    )
    .eq("id", profile.clinic_id)
    .maybeSingle();

  return {
    error: null,
    data: {
      mode: (clinic?.no_show_fee_mode as NoShowFeeMode) ?? "none",
      amount:
        clinic?.no_show_fee_amount != null ? Number(clinic.no_show_fee_amount) : null,
      percent:
        clinic?.no_show_fee_percent != null ? Number(clinic.no_show_fee_percent) : null,
      serviceId: clinic?.no_show_service_id ? String(clinic.no_show_service_id) : null,
    },
  };
}

export type { CancellationType } from "./encounter-actions";

export async function updateClinicNoShowFeeSettings(input: {
  mode: NoShowFeeMode;
  amount?: number | null;
  percent?: number | null;
  serviceId?: string | null;
}): Promise<{ error: string | null }> {
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
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão." };
  }

  const { error } = await supabase
    .from("clinics")
    .update({
      no_show_fee_mode: input.mode,
      no_show_fee_amount: input.amount ?? null,
      no_show_fee_percent: input.percent ?? null,
      no_show_service_id: input.serviceId || null,
    })
    .eq("id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}
