"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  ensureEncounter,
  computeBillingFromLines,
  consumeStockForAppointment,
  hasStockBeenConsumed,
} from "@/lib/clinic-operations";
import { resolveAppointmentPrice } from "./actions";
import { provisionAppointmentFichas } from "@/lib/clinical-fichas-provision";

export type PaymentPolicy = "antecipado" | "no_dia" | "pos_atendimento";

export type BillingPreview = {
  serviceAmount: number;
  materialsAmount: number;
  subtotalAmount: number;
  subtotalWithMaterials: number;
  subtotalWithoutMaterials: number;
  discountAmount: number;
  totalAmount: number;
  serviceName: string | null;
  materialLines: { name: string; quantity: number; unit_price: number; line_total: number }[];
};

export type EmitComandaOptions = {
  chargeMaterialsSeparately?: boolean;
  discountAmount?: number;
  discountPercent?: number;
  notes?: string | null;
  paymentAmount?: number;
  paymentMethod?: string;
  paidAt?: string;
};

export type AppointmentComandaSummary = {
  id: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  remainder: number;
  subtotal_amount: number | null;
  discount_amount: number;
  issued_at: string | null;
};

export type ConsumptionLine = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  source: string;
  locked_at: string | null;
  stock_on_hand?: number;
  stock_committed?: number;
  stock_available?: number;
  unit?: string;
  unit_price?: number;
};

export type ComandaDetail = {
  id: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  remainder: number;
  created_at: string;
  items: {
    id: string;
    item_type: string;
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
  payments: {
    id: string;
    amount: number;
    paid_at: string;
    payment_method: string | null;
  }[];
};

export async function getAppointmentConsumption(appointmentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [], encounter: null };

  const { data: lines, error } = await supabase
    .from("appointment_consumption_lines")
    .select(
      "id, product_id, quantity, source, locked_at, products(name, unit, cost, sale_price, stock_balances(quantity_on_hand, quantity_committed))"
    )
    .eq("appointment_id", appointmentId);

  if (error) return { error: error.message, data: [], encounter: null };

  const { data: encounter } = await supabase
    .from("encounters")
    .select("id, status, stock_consumed_at, completed_at")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  const { data: comanda } = await supabase
    .from("comandas")
    .select("id, status, total_amount, paid_amount, subtotal_amount, discount_amount, issued_at")
    .eq("appointment_id", appointmentId)
    .neq("status", "cancelada")
    .maybeSingle();

  const data: ConsumptionLine[] = (lines ?? []).map((r: Record<string, unknown>) => {
    const prod = Array.isArray(r.products) ? r.products[0] : r.products;
    const balRaw = (prod as { stock_balances?: unknown })?.stock_balances;
    const bal = Array.isArray(balRaw) ? balRaw[0] : balRaw;
    const onHand = Number((bal as { quantity_on_hand?: number })?.quantity_on_hand) || 0;
    const committed = Number((bal as { quantity_committed?: number })?.quantity_committed) || 0;
    const cost = Number((prod as { cost?: number })?.cost) || 0;
    const sale = (prod as { sale_price?: number | null })?.sale_price;
    const unitPrice =
      sale != null && Number(sale) > 0 ? Number(sale) : cost > 0 ? cost : 0;
    return {
      id: String(r.id),
      product_id: String(r.product_id),
      product_name: String((prod as { name?: string })?.name ?? ""),
      quantity: Number(r.quantity),
      source: String(r.source),
      locked_at: r.locked_at != null ? String(r.locked_at) : null,
      stock_on_hand: onHand,
      stock_committed: committed,
      stock_available: onHand - committed,
      unit: String((prod as { unit?: string })?.unit ?? "un"),
      unit_price: unitPrice,
    };
  });

  return {
    error: null,
    data,
    encounter,
    comanda: comanda
      ? {
          id: String(comanda.id),
          status: String(comanda.status),
          total_amount: Number(comanda.total_amount),
          paid_amount: Number(comanda.paid_amount),
          remainder: Math.max(0, Number(comanda.total_amount) - Number(comanda.paid_amount)),
          subtotal_amount:
            comanda.subtotal_amount != null ? Number(comanda.subtotal_amount) : null,
          discount_amount: Number(comanda.discount_amount ?? 0),
          issued_at: comanda.issued_at != null ? String(comanda.issued_at) : null,
        }
      : null,
  };
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
  if (enc?.status === "finalizado_aguardando_cobranca") {
    return { error: "Atendimento clínico encerrado — consumo bloqueado." };
  }

  const { error } = await supabase.from("appointment_consumption_lines").insert({
    appointment_id: appointmentId,
    product_id: productId,
    quantity,
    source: "manual_add",
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  revalidatePath(`/dashboard/agenda/atendimento/${appointmentId}`);
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

  if (line?.locked_at) return { error: "Linha bloqueada após encerramento clínico." };

  const { error } = await supabase
    .from("appointment_consumption_lines")
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq("id", lineId);

  if (error) return { error: error.message };
  if (line?.appointment_id) {
    revalidatePath(`/dashboard/agenda/consulta/${line.appointment_id}`);
    revalidatePath(`/dashboard/agenda/atendimento/${line.appointment_id}`);
  }
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

  if (line?.locked_at) return { error: "Linha bloqueada após encerramento clínico." };

  const { error } = await supabase.from("appointment_consumption_lines").delete().eq("id", lineId);
  if (error) return { error: error.message };
  if (line?.appointment_id) {
    revalidatePath(`/dashboard/agenda/consulta/${line.appointment_id}`);
    revalidatePath(`/dashboard/agenda/atendimento/${line.appointment_id}`);
  }
  return { error: null };
}

export async function getClinicBillingDefaults() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", chargeMaterialsSeparately: true };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", chargeMaterialsSeparately: true };

  const { data: clinic } = await supabase
    .from("clinics")
    .select("charge_materials_by_default")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  return {
    error: null,
    chargeMaterialsSeparately: clinic?.charge_materials_by_default !== false,
  };
}

async function buildBillingPreviewData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appointmentId: string,
  options?: {
    chargeMaterialsSeparately?: boolean;
    discountAmount?: number;
    discountPercent?: number;
  }
) {
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, service_id, valor, doctor_id, services(nome)")
    .eq("id", appointmentId)
    .single();

  if (!appt) return { error: "Consulta não encontrada.", data: null as BillingPreview | null };

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

  const withMaterials = computeBillingFromLines(
    serviceAmount,
    materialLines.map((l) => ({
      quantity: l.quantity,
      sale_price: l.sale_price,
      cost: l.cost,
    })),
    { includeMaterials: true }
  );

  const withoutMaterials = computeBillingFromLines(
    serviceAmount,
    materialLines.map((l) => ({
      quantity: l.quantity,
      sale_price: l.sale_price,
      cost: l.cost,
    })),
    { includeMaterials: false }
  );

  const includeMaterials = options?.chargeMaterialsSeparately !== false;
  const totals = computeBillingFromLines(
    serviceAmount,
    materialLines.map((l) => ({
      quantity: l.quantity,
      sale_price: l.sale_price,
      cost: l.cost,
    })),
    {
      includeMaterials,
      discountAmount: options?.discountAmount,
      discountPercent: options?.discountPercent,
    }
  );

  return {
    error: null,
    data: {
      serviceAmount: totals.serviceAmount,
      materialsAmount: totals.materialsAmount,
      subtotalAmount: totals.subtotalAmount,
      subtotalWithMaterials: withMaterials.subtotalAmount,
      subtotalWithoutMaterials: withoutMaterials.subtotalAmount,
      discountAmount: totals.discountAmount,
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

export async function getBillingPreview(
  appointmentId: string,
  options?: {
    chargeMaterialsSeparately?: boolean;
    discountAmount?: number;
    discountPercent?: number;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  return buildBillingPreviewData(supabase, appointmentId, options);
}

export async function getComandaDetail(comandaId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: cmd, error } = await supabase
    .from("comandas")
    .select("id, status, total_amount, paid_amount, created_at, clinic_id")
    .eq("id", comandaId)
    .single();

  if (error || !cmd) return { error: "Comanda não encontrada.", data: null };

  const { data: items } = await supabase
    .from("comanda_items")
    .select("id, item_type, description, quantity, unit_price, total_price")
    .eq("comanda_id", comandaId);

  const { data: payments } = await supabase
    .from("patient_payments")
    .select("id, amount, paid_at, payment_method")
    .eq("comanda_id", comandaId)
    .order("paid_at", { ascending: false });

  const total = Number(cmd.total_amount);
  const paid = Number(cmd.paid_amount);

  return {
    error: null,
    data: {
      id: cmd.id,
      status: cmd.status as string,
      total_amount: total,
      paid_amount: paid,
      remainder: Math.max(0, total - paid),
      created_at: cmd.created_at as string,
      items: (items ?? []).map((i) => ({
        id: i.id,
        item_type: i.item_type,
        description: i.description,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        total_price: Number(i.total_price),
      })),
      payments: (payments ?? []).map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paid_at: p.paid_at as string,
        payment_method: p.payment_method != null ? String(p.payment_method) : null,
      })),
    } satisfies ComandaDetail,
  };
}

export async function registerComandaPayment(
  comandaId: string,
  amount: number,
  paymentMethod?: string,
  paidAt?: string,
  options?: {
    bank_account_id?: string;
    card_brand?: string;
    installments?: number;
    generate_receipt?: boolean;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  const { data: cmd } = await supabase
    .from("comandas")
    .select("id, clinic_id, patient_id, appointment_id, total_amount, paid_amount, status")
    .eq("id", comandaId)
    .single();

  if (!cmd || cmd.status === "cancelada") return { error: "Comanda inválida." };

  const remainder = Math.max(
    0,
    Number(cmd.total_amount) - Number(cmd.paid_amount)
  );
  if (amount > remainder + 0.009) {
    return {
      error: `Valor máximo a receber: R$ ${remainder.toFixed(2).replace(".", ",")}.`,
    };
  }

  const newPaid = Number(cmd.paid_amount) + amount;
  const total = Number(cmd.total_amount);
  const newStatus =
    newPaid >= total && total > 0 ? "paga" : newPaid > 0 ? "parcial" : cmd.status;

  const { error: updErr } = await supabase
    .from("comandas")
    .update({
      paid_amount: newPaid,
      status: newStatus,
      closed_at: newStatus === "paga" ? new Date().toISOString() : undefined,
    })
    .eq("id", comandaId);

  if (updErr) return { error: updErr.message };

  if (newStatus === "paga" && cmd.appointment_id) {
    await supabase
      .from("encounters")
      .update({ status: "cobrado", updated_at: new Date().toISOString() })
      .eq("appointment_id", cmd.appointment_id);
  }

  const paymentTimestamp = paidAt
    ? new Date(paidAt + (paidAt.length <= 10 ? "T12:00:00" : "")).toISOString()
    : new Date().toISOString();

  const { resolvePaymentFee } = await import("../financeiro/bank-account-actions");
  const feeCalc = await resolvePaymentFee(
    profile.clinic_id,
    paymentMethod ?? "pix",
    amount,
    { card_brand: options?.card_brand, installments: options?.installments }
  );
  const netAmount = feeCalc.netAmount;

  const { data: paymentRow, error: payErr } = await supabase
    .from("patient_payments")
    .insert({
      clinic_id: profile.clinic_id,
      comanda_id: comandaId,
      patient_id: cmd.patient_id,
      amount,
      gross_amount: amount,
      fee_amount: feeCalc.feeAmount,
      net_amount: netAmount,
      bank_account_id: options?.bank_account_id ?? null,
      installments: options?.installments ?? 1,
      card_brand: options?.card_brand ?? null,
      payment_method: paymentMethod ?? null,
      paid_at: paymentTimestamp,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (payErr) return { error: payErr.message };

  await supabase.from("financial_entries").insert({
    clinic_id: profile.clinic_id,
    entry_type: "receita",
    origin: "patient",
    description: "Pagamento comanda",
    amount: netAmount,
    paid_at: paymentTimestamp,
    status: "pago",
    patient_id: cmd.patient_id,
    comanda_id: comandaId,
    created_by: user.id,
  });

  let receiptNumber: string | null = null;
  let receiptId: string | null = null;
  if (options?.generate_receipt !== false && paymentRow?.id) {
    const { generateReceiptForPayment } = await import("../financeiro/receipt-actions");
    const rec = await generateReceiptForPayment(String(paymentRow.id));
    if (!rec.error) {
      receiptNumber = rec.receiptNumber ?? null;
      receiptId = rec.receiptId ?? null;
    }
  }

  revalidatePath("/dashboard/financeiro");
  if (cmd.appointment_id) {
    revalidatePath(`/dashboard/agenda/atendimento/${cmd.appointment_id}`);
    revalidatePath(`/dashboard/agenda/consulta/${cmd.appointment_id}`);
  }
  revalidatePath(`/dashboard/contatos/pacientes/${cmd.patient_id}`);
  revalidatePath(`/dashboard/pacientes/${cmd.patient_id}`);
  return { error: null, receiptNumber, receiptId, paymentId: paymentRow?.id ? String(paymentRow.id) : null };
}

export async function finishClinicalEncounter(appointmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  const encounter = await ensureEncounter(supabase, profile.clinic_id, appointmentId);
  if (!encounter) return { error: "Erro ao criar atendimento." };

  if (encounter.status === "cobrado") {
    return { error: "Atendimento já quitado." };
  }

  if (encounter.status === "finalizado_aguardando_cobranca") {
    return { error: null, alreadyFinished: true };
  }

  if (encounter.status !== "em_andamento") {
    return { error: "Atendimento não está em andamento." };
  }

  const already = await hasStockBeenConsumed(supabase, appointmentId);
  if (!already) {
    try {
      await consumeStockForAppointment(supabase, profile.clinic_id, appointmentId, user.id);
      await supabase
        .from("encounters")
        .update({
          stock_consumed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("appointment_id", appointmentId);
    } catch (e) {
      console.error("[finishClinicalEncounter] stock consume:", e);
      return { error: "Erro ao lançar consumo de material no estoque." };
    }
  }

  const now = new Date().toISOString();

  await supabase
    .from("appointment_consumption_lines")
    .update({ locked_at: now })
    .eq("appointment_id", appointmentId)
    .is("locked_at", null);

  await supabase
    .from("encounters")
    .update({
      status: "finalizado_aguardando_cobranca",
      completed_at: now,
      updated_at: now,
    })
    .eq("appointment_id", appointmentId);

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, patient_id, status")
    .eq("id", appointmentId)
    .single();

  if (appt && (appt.status === "agendada" || appt.status === "confirmada")) {
    await supabase
      .from("appointments")
      .update({ status: "realizada", updated_at: now })
      .eq("id", appointmentId);
  }

  await supabase
    .from("appointment_ficha_instances")
    .update({ status: "concluida", updated_at: now })
    .eq("appointment_id", appointmentId)
    .neq("status", "concluida");

  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  revalidatePath(`/dashboard/agenda/atendimento/${appointmentId}`);
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/atendimento");
  if (appt?.patient_id) {
    revalidatePath(`/dashboard/contatos/pacientes/${appt.patient_id}`);
    revalidatePath(`/dashboard/pacientes/${appt.patient_id}`);
  }

  return { error: null };
}

export async function emitComanda(appointmentId: string, options?: EmitComandaOptions) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  const { data: existingComanda } = await supabase
    .from("comandas")
    .select("id, status")
    .eq("appointment_id", appointmentId)
    .neq("status", "cancelada")
    .maybeSingle();

  if (existingComanda) {
    return { error: "Já existe comanda para esta consulta.", comandaId: existingComanda.id };
  }

  const { data: enc } = await supabase
    .from("encounters")
    .select("id, status")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (!enc || enc.status !== "finalizado_aguardando_cobranca") {
    return { error: "Encerre o atendimento clínico antes de emitir a comanda." };
  }

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, patient_id, service_id, valor, clinic_id, status")
    .eq("id", appointmentId)
    .single();

  if (!appt) return { error: "Consulta não encontrada." };

  const chargeMaterialsSeparately = options?.chargeMaterialsSeparately !== false;
  const previewRes = await buildBillingPreviewData(supabase, appointmentId, {
    chargeMaterialsSeparately,
    discountAmount: options?.discountAmount,
    discountPercent: options?.discountPercent,
  });
  if (previewRes.error || !previewRes.data) {
    return { error: previewRes.error ?? "Erro ao calcular totais." };
  }

  const billing = previewRes.data;
  const totalAmount = billing.totalAmount;
  const serviceAmount = billing.serviceAmount;
  const paymentAmount = Math.max(0, options?.paymentAmount ?? 0);
  const issuedAt = new Date().toISOString();

  const comandaStatus =
    paymentAmount >= totalAmount && totalAmount > 0
      ? "paga"
      : paymentAmount > 0
        ? "parcial"
        : "aberta";

  const { data: comanda, error: comandaErr } = await supabase
    .from("comandas")
    .insert({
      clinic_id: profile.clinic_id,
      appointment_id: appointmentId,
      patient_id: appt.patient_id,
      encounter_id: enc.id,
      subtotal_amount: billing.subtotalAmount,
      discount_amount: billing.discountAmount,
      discount_percent: options?.discountPercent ?? null,
      charge_materials_separately: chargeMaterialsSeparately,
      total_amount: totalAmount,
      paid_amount: paymentAmount,
      status: comandaStatus,
      issued_at: issuedAt,
      closed_at: comandaStatus === "paga" ? issuedAt : null,
      notes: options?.notes?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (comandaErr) return { error: comandaErr.message };

  if (appt.service_id && serviceAmount > 0) {
    const { data: svc } = await supabase
      .from("services")
      .select("nome")
      .eq("id", appt.service_id)
      .single();
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

  if (chargeMaterialsSeparately) {
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
  }

  await supabase
    .from("appointments")
    .update({ valor: totalAmount, updated_at: issuedAt })
    .eq("id", appointmentId);

  if (comandaStatus === "paga") {
    await supabase
      .from("encounters")
      .update({ status: "cobrado", updated_at: issuedAt })
      .eq("appointment_id", appointmentId);
  }

  if (paymentAmount > 0 && comanda) {
    const paymentTimestamp = options?.paidAt
      ? new Date(
          options.paidAt + (options.paidAt.length <= 10 ? "T12:00:00" : "")
        ).toISOString()
      : issuedAt;

    await supabase.from("patient_payments").insert({
      clinic_id: profile.clinic_id,
      comanda_id: comanda.id,
      patient_id: appt.patient_id,
      amount: paymentAmount,
      payment_method: options?.paymentMethod ?? null,
      paid_at: paymentTimestamp,
      created_by: user.id,
    });

    await supabase.from("financial_entries").insert({
      clinic_id: profile.clinic_id,
      entry_type: "receita",
      origin: "patient",
      description: "Pagamento comanda",
      amount: paymentAmount,
      paid_at: paymentTimestamp,
      status: "pago",
      patient_id: appt.patient_id,
      comanda_id: comanda.id,
      created_by: user.id,
    });
  }

  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  revalidatePath(`/dashboard/agenda/atendimento/${appointmentId}`);
  revalidatePath("/dashboard/financeiro");
  revalidatePath("/dashboard/financeiro/receber");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/atendimento");
  revalidatePath(`/dashboard/contatos/pacientes/${appt.patient_id}`);
  revalidatePath(`/dashboard/pacientes/${appt.patient_id}`);

  const detail = await getComandaDetail(comanda!.id);
  return { error: null, comandaId: comanda?.id, comanda: detail.data, billing: previewRes.data };
}

export async function finalizeBilling(
  appointmentId: string,
  paymentAmount: number,
  paymentMethod?: string,
  options?: { consumeStock?: boolean }
) {
  if (options?.consumeStock === false) {
    const emitOnly = await emitComanda(appointmentId, {
      paymentAmount,
      paymentMethod,
      chargeMaterialsSeparately: true,
    });
    if (emitOnly.error && !emitOnly.error.includes("Encerre o atendimento")) {
      return emitOnly;
    }
    if (!emitOnly.error) return emitOnly;
  }

  const clinicalRes = await finishClinicalEncounter(appointmentId);
  if (clinicalRes.error && !clinicalRes.alreadyFinished) {
    return { error: clinicalRes.error };
  }

  return emitComanda(appointmentId, {
    paymentAmount,
    paymentMethod,
    chargeMaterialsSeparately: true,
  });
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

  const { data: appt } = await supabase
    .from("appointments")
    .select("procedure:procedures!procedure_id ( id, name )")
    .eq("id", appointmentId)
    .maybeSingle();
  const legacyProc = appt
    ? Array.isArray(appt.procedure)
      ? appt.procedure[0]
      : appt.procedure
    : undefined;
  await provisionAppointmentFichas(supabase, profile.clinic_id, appointmentId, legacyProc, user.id);

  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  revalidatePath(`/dashboard/agenda/atendimento/${appointmentId}`);
  return { error: null };
}

/** Inicia consulta (timer) + encounter clínico em uma ação — botão Atender. */
export async function beginAppointmentCare(appointmentId: string) {
  const { startAppointmentConsultation } = await import("./actions");
  const apptRes = await startAppointmentConsultation(appointmentId);
  if (apptRes.error && !apptRes.error.includes("já foi iniciada")) {
    return apptRes;
  }
  return startEncounter(appointmentId);
}

export async function getAppointmentPaymentPolicy(appointmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", policy: null as PaymentPolicy | null };

  const { data: appt, error } = await supabase
    .from("appointments")
    .select("payment_policy")
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    if (error.message.includes("payment_policy")) {
      return { error: null, policy: null };
    }
    return { error: error.message, policy: null };
  }

  const p = appt?.payment_policy as PaymentPolicy | null | undefined;
  return { error: null, policy: p ?? null };
}

export async function setAppointmentPaymentPolicy(
  appointmentId: string,
  policy: PaymentPolicy
) {
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
  if (profile.role === "medico") return { error: "Sem permissão." };

  const { error } = await supabase
    .from("appointments")
    .update({ payment_policy: policy, updated_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id);

  if (error) {
    if (error.message.includes("payment_policy")) {
      return { error: "Migration operational-flow-extensions não aplicada." };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  revalidatePath("/dashboard/atendimento");
  return { error: null };
}

export async function listOpenComandas() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };
  if (profile.role === "medico") return { error: "Sem permissão.", data: [] };

  const { data, error } = await supabase
    .from("comandas")
    .select(
      `
      id,
      status,
      total_amount,
      paid_amount,
      created_at,
      patient:patients ( full_name ),
      appointment:appointments ( scheduled_at )
    `
    )
    .eq("clinic_id", profile.clinic_id)
    .in("status", ["aberta", "parcial"])
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };

  return {
    error: null,
    data: (data ?? []).map((c: Record<string, unknown>) => {
      const patient = Array.isArray(c.patient) ? c.patient[0] : c.patient;
      const appt = Array.isArray(c.appointment) ? c.appointment[0] : c.appointment;
      const total = Number(c.total_amount);
      const paid = Number(c.paid_amount);
      return {
        id: String(c.id),
        status: String(c.status),
        total_amount: total,
        paid_amount: paid,
        remainder: Math.max(0, total - paid),
        created_at: String(c.created_at),
        patient_name: (patient as { full_name?: string })?.full_name ?? "—",
        scheduled_at: appt ? String((appt as { scheduled_at: string }).scheduled_at) : null,
      };
    }),
  };
}

// FINANCEIRO FASE 1 — ITEM 5: cancelamento de comanda
export async function cancelComanda(comandaId: string, reason?: string) {
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

  const { data: cmd } = await supabase
    .from("comandas")
    .select("id, status, patient_id, appointment_id, total_amount, paid_amount")
    .eq("id", comandaId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!cmd) return { error: "Comanda não encontrada." };
  if (cmd.status === "cancelada") return { error: "Comanda já cancelada." };

  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("comandas")
    .update({
      status: "cancelada",
      cancelled_at: now,
      cancelled_reason: reason?.trim() || null,
    })
    .eq("id", comandaId);

  if (updErr) return { error: updErr.message };

  await supabase
    .from("financial_entries")
    .update({ status: "cancelado" })
    .eq("comanda_id", comandaId)
    .neq("status", "cancelado");

  revalidatePath("/dashboard/financeiro");
  revalidatePath("/dashboard/financeiro/receber");
  if (cmd.appointment_id) {
    revalidatePath(`/dashboard/agenda/atendimento/${cmd.appointment_id}`);
    revalidatePath(`/dashboard/agenda/consulta/${cmd.appointment_id}`);
  }
  revalidatePath(`/dashboard/pacientes/${cmd.patient_id}`);
  revalidatePath(`/dashboard/contatos/pacientes/${cmd.patient_id}`);

  return {
    error: null,
    paidAmount: Number(cmd.paid_amount),
    totalAmount: Number(cmd.total_amount),
  };
}
