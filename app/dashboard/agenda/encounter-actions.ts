"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { ensureEncounter, computeBillingFromLines } from "@/lib/clinic-operations";
import { resolveAppointmentPrice } from "./actions";

export type BillingPreview = {
  serviceAmount: number;
  materialsAmount: number;
  totalAmount: number;
  serviceName: string | null;
  materialLines: { name: string; quantity: number; unit_price: number; line_total: number }[];
};

export type ConsumptionLine = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  source: string;
  locked_at: string | null;
};

export async function getAppointmentConsumption(appointmentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [], encounter: null };

  const { data: lines, error } = await supabase
    .from("appointment_consumption_lines")
    .select("id, product_id, quantity, source, locked_at, products(name)")
    .eq("appointment_id", appointmentId);

  if (error) return { error: error.message, data: [], encounter: null };

  const { data: encounter } = await supabase
    .from("encounters")
    .select("id, status")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  const data: ConsumptionLine[] = (lines ?? []).map((r: Record<string, unknown>) => {
    const prod = Array.isArray(r.products) ? r.products[0] : r.products;
    return {
      id: String(r.id),
      product_id: String(r.product_id),
      product_name: String((prod as { name?: string })?.name ?? ""),
      quantity: Number(r.quantity),
      source: String(r.source),
      locked_at: r.locked_at != null ? String(r.locked_at) : null,
    };
  });

  return { error: null, data, encounter };
}

export async function addConsumptionLine(appointmentId: string, productId: string, quantity: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: enc } = await supabase
    .from("encounters")
    .select("status")
    .eq("appointment_id", appointmentId)
    .maybeSingle();
  if (enc?.status === "cobrado") return { error: "Consumo já foi fechado na cobrança." };

  const { error } = await supabase.from("appointment_consumption_lines").insert({
    appointment_id: appointmentId,
    product_id: productId,
    quantity,
    source: "manual_add",
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  return { error: null };
}

export async function updateConsumptionQuantity(lineId: string, quantity: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: line } = await supabase
    .from("appointment_consumption_lines")
    .select("locked_at, appointment_id")
    .eq("id", lineId)
    .single();

  if (line?.locked_at) return { error: "Linha bloqueada após cobrança." };

  const { error } = await supabase
    .from("appointment_consumption_lines")
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq("id", lineId);

  if (error) return { error: error.message };
  if (line?.appointment_id) revalidatePath(`/dashboard/agenda/consulta/${line.appointment_id}`);
  return { error: null };
}

export async function removeConsumptionLine(lineId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: line } = await supabase
    .from("appointment_consumption_lines")
    .select("locked_at, appointment_id")
    .eq("id", lineId)
    .single();

  if (line?.locked_at) return { error: "Linha bloqueada após cobrança." };

  const { error } = await supabase.from("appointment_consumption_lines").delete().eq("id", lineId);
  if (error) return { error: error.message };
  if (line?.appointment_id) revalidatePath(`/dashboard/agenda/consulta/${line.appointment_id}`);
  return { error: null };
}

export async function getBillingPreview(appointmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, service_id, valor, doctor_id, services(nome)")
    .eq("id", appointmentId)
    .single();

  if (!appt) return { error: "Consulta não encontrada.", data: null };

  const { data: dimRows } = await supabase
    .from("appointment_dimension_values")
    .select("dimension_value_id")
    .eq("appointment_id", appointmentId);

  const dimensionValueIds = (dimRows ?? []).map((r) => r.dimension_value_id as string);

  let serviceAmount = 0;
  let serviceName: string | null = null;
  const svc = Array.isArray(appt.services) ? appt.services[0] : appt.services;
  serviceName = (svc as { nome?: string })?.nome ?? null;

  if (appt.service_id && appt.doctor_id) {
    const priceRes = await resolveAppointmentPrice(
      appt.service_id as string,
      appt.doctor_id as string,
      dimensionValueIds
    );
    serviceAmount = priceRes.valor ?? (Number(appt.valor) || 0);
  } else {
    serviceAmount = Number(appt.valor) || 0;
  }

  const { data: consumption } = await supabase
    .from("appointment_consumption_lines")
    .select("quantity, products(name, cost, sale_price)")
    .eq("appointment_id", appointmentId);

  const materialLines = (consumption ?? []).map((line: Record<string, unknown>) => {
    const prod = Array.isArray(line.products) ? line.products[0] : line.products;
    const cost = Number((prod as { cost?: number })?.cost) || 0;
    const sale_price = (prod as { sale_price?: number | null })?.sale_price;
    const quantity = Number(line.quantity);
    const unit =
      sale_price != null && Number(sale_price) > 0
        ? Number(sale_price)
        : cost > 0
          ? cost
          : 0;
    return {
      name: String((prod as { name?: string })?.name ?? "Material"),
      quantity,
      unit_price: unit,
      line_total: Number((quantity * unit).toFixed(2)),
      sale_price: sale_price != null ? Number(sale_price) : null,
      cost,
    };
  });

  const totals = computeBillingFromLines(
    serviceAmount,
    materialLines.map((l) => ({
      quantity: l.quantity,
      sale_price: l.sale_price,
      cost: l.cost,
    }))
  );

  return {
    error: null,
    data: {
      serviceAmount: totals.serviceAmount,
      materialsAmount: totals.materialsAmount,
      totalAmount: totals.totalAmount,
      serviceName,
      materialLines: materialLines.map(({ name, quantity, unit_price, line_total }) => ({
        name,
        quantity,
        unit_price,
        line_total,
      })),
    } satisfies BillingPreview,
  };
}

export async function finalizeBilling(
  appointmentId: string,
  paymentAmount: number,
  paymentMethod?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, patient_id, service_id, valor, clinic_id")
    .eq("id", appointmentId)
    .single();

  if (!appt) return { error: "Consulta não encontrada." };

  const encounter = await ensureEncounter(supabase, profile.clinic_id, appointmentId);
  if (!encounter) return { error: "Erro ao criar atendimento." };

  const previewRes = await getBillingPreview(appointmentId);
  const billing = previewRes.data;
  const totalAmount = billing?.totalAmount ?? (Number(appt.valor) || 0);
  const serviceAmount = billing?.serviceAmount ?? 0;

  const { data: comanda, error: comandaErr } = await supabase
    .from("comandas")
    .insert({
      clinic_id: profile.clinic_id,
      appointment_id: appointmentId,
      patient_id: appt.patient_id,
      encounter_id: encounter.id,
      total_amount: totalAmount,
      paid_amount: paymentAmount,
      status: paymentAmount >= totalAmount && totalAmount > 0 ? "paga" : paymentAmount > 0 ? "parcial" : "aberta",
      closed_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (comandaErr) return { error: comandaErr.message };

  if (appt.service_id && serviceAmount > 0) {
    const { data: svc } = await supabase.from("services").select("nome").eq("id", appt.service_id).single();
    await supabase.from("comanda_items").insert({
      comanda_id: comanda!.id,
      item_type: "service",
      description: svc?.nome ?? "Serviço",
      quantity: 1,
      unit_price: serviceAmount,
      total_price: serviceAmount,
      reference_id: appt.service_id,
    });
  }

  const { data: consumption } = await supabase
    .from("appointment_consumption_lines")
    .select("id, product_id, quantity, products(name, cost, sale_price)")
    .eq("appointment_id", appointmentId);

  for (const line of consumption ?? []) {
    const prod = Array.isArray(line.products) ? line.products[0] : line.products;
    const cost = Number((prod as { cost?: number })?.cost) || 0;
    const sale = (prod as { sale_price?: number | null })?.sale_price;
    const unitPrice =
      sale != null && Number(sale) > 0 ? Number(sale) : cost > 0 ? cost : 0;
    const qty = Number(line.quantity);
    if (qty > 0 && unitPrice > 0) {
      await supabase.from("comanda_items").insert({
        comanda_id: comanda!.id,
        item_type: "product",
        description: (prod as { name?: string })?.name ?? "Material",
        quantity: qty,
        unit_price: unitPrice,
        total_price: Number((qty * unitPrice).toFixed(2)),
        reference_id: line.product_id,
      });
    }
  }

  await supabase
    .from("appointments")
    .update({ valor: totalAmount, updated_at: new Date().toISOString() })
    .eq("id", appointmentId);

  await supabase
    .from("appointment_consumption_lines")
    .update({ locked_at: new Date().toISOString() })
    .eq("appointment_id", appointmentId)
    .is("locked_at", null);

  await supabase
    .from("encounters")
    .update({ status: "cobrado", updated_at: new Date().toISOString() })
    .eq("appointment_id", appointmentId);

  if (paymentAmount > 0 && comanda) {
    await supabase.from("patient_payments").insert({
      clinic_id: profile.clinic_id,
      comanda_id: comanda.id,
      patient_id: appt.patient_id,
      amount: paymentAmount,
      payment_method: paymentMethod ?? null,
      created_by: user.id,
    });

    await supabase.from("financial_entries").insert({
      clinic_id: profile.clinic_id,
      entry_type: "receita",
      origin: "patient",
      description: `Pagamento consulta`,
      amount: paymentAmount,
      paid_at: new Date().toISOString(),
      status: "pago",
      patient_id: appt.patient_id,
      comanda_id: comanda.id,
      created_by: user.id,
    });
  }

  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  revalidatePath("/dashboard/financeiro");
  revalidatePath(`/dashboard/pacientes/${appt.patient_id}`);
  return { error: null, comandaId: comanda?.id };
}

export async function startEncounter(appointmentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  await ensureEncounter(supabase, profile.clinic_id, appointmentId);
  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  return { error: null };
}
