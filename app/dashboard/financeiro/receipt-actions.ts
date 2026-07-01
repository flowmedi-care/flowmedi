"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  renderReceiptPdfBuffer,
  type ReceiptPdfLine,
  type ReceiptPdfItem,
} from "@/lib/financeiro/receipt-pdf";
import { isStoragePath, toStoragePath } from "@/lib/storage/storage-ref";
import { createAuthenticatedSignedUrl } from "@/lib/storage/signed-url";

const RECEIPTS_BUCKET = "receipts";

type ComandaReceiptDetails = {
  items: ReceiptPdfItem[];
  subtotal_amount: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  paid_amount: number | null;
  status: string | null;
  remainder: number | null;
};

async function loadComandaReceiptDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comandaId: string | null
): Promise<ComandaReceiptDetails> {
  const empty: ComandaReceiptDetails = {
    items: [],
    subtotal_amount: null,
    discount_amount: null,
    total_amount: null,
    paid_amount: null,
    status: null,
    remainder: null,
  };
  if (!comandaId) return empty;

  const { data: cmd } = await supabase
    .from("comandas")
    .select(
      "subtotal_amount, discount_amount, total_amount, paid_amount, status, charge_materials_separately"
    )
    .eq("id", comandaId)
    .maybeSingle();

  if (!cmd) return empty;

  const { data: itemRows } = await supabase
    .from("comanda_items")
    .select("description, quantity, total_price, item_type")
    .eq("comanda_id", comandaId)
    .order("created_at", { ascending: true });

  const chargeMaterials = cmd.charge_materials_separately !== false;
  const items: ReceiptPdfItem[] = (itemRows ?? [])
    .filter((row) => {
      const type = String(row.item_type);
      return type === "service" || (chargeMaterials && type === "product");
    })
    .map((row) => ({
      label: String(row.description),
      quantity: Number(row.quantity),
      amount: Number(row.total_price),
    }));

  const total = Number(cmd.total_amount);
  const paid = Number(cmd.paid_amount);
  const remainder = Math.max(0, total - paid);
  const showRemainder =
    remainder > 0 && (cmd.status === "aberta" || cmd.status === "parcial") ? remainder : null;

  return {
    items,
    subtotal_amount: Number(cmd.subtotal_amount ?? total),
    discount_amount: Number(cmd.discount_amount ?? 0),
    total_amount: total,
    paid_amount: paid,
    status: String(cmd.status),
    remainder: showRemainder,
  };
}

async function buildReceiptPdfPayload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  receiptId: string,
  paymentId: string,
  voided: boolean
) {
  const { data: receipt } = await supabase
    .from("receipts")
    .select(
      `
      id,
      receipt_number,
      issued_at,
      voided_at,
      comanda_id,
      clinic_id,
      patient:patients ( full_name ),
      payment:patient_payments ( amount, gross_amount, payment_method, paid_at, comanda_id )
    `
    )
    .eq("id", receiptId)
    .single();

  if (!receipt) return null;

  const patient = Array.isArray(receipt.patient) ? receipt.patient[0] : receipt.patient;
  const payment = Array.isArray(receipt.payment) ? receipt.payment[0] : receipt.payment;
  const pay = payment as {
    gross_amount?: number;
    amount?: number;
    payment_method?: string;
    paid_at?: string;
    comanda_id?: string;
  };

  const comandaId = receipt.comanda_id ?? pay.comanda_id ?? null;
  const lines: ReceiptPdfLine[] = [];
  const cashAmount = Number(pay.gross_amount ?? pay.amount ?? 0);

  if (pay.payment_method === "credito_interno") {
    lines.push({ label: "Crédito aplicado", amount: cashAmount, method: "crédito interno" });
  } else if (cashAmount > 0) {
    lines.push({
      label: "Valor recebido",
      amount: cashAmount,
      method: pay.payment_method ?? null,
    });
  }

  if (comandaId && pay.payment_method !== "credito_interno") {
    const { data: creditPayments } = await supabase
      .from("patient_payments")
      .select("amount, gross_amount, payment_method, paid_at")
      .eq("comanda_id", comandaId)
      .eq("payment_method", "credito_interno")
      .order("paid_at", { ascending: false });

    for (const cp of creditPayments ?? []) {
      const cpPaidAt = cp.paid_at ? new Date(cp.paid_at).getTime() : 0;
      const payPaidAt = pay.paid_at ? new Date(pay.paid_at).getTime() : 0;
      if (Math.abs(cpPaidAt - payPaidAt) < 120_000) {
        lines.push({
          label: "Crédito aplicado",
          amount: -Number(cp.gross_amount ?? cp.amount),
          method: "crédito interno",
        });
      }
    }
  }

  const comandaDetails = await loadComandaReceiptDetails(supabase, comandaId);

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, address, phone, tax_id")
    .eq("id", receipt.clinic_id)
    .maybeSingle();

  const totalReceived = lines.reduce((s, l) => s + l.amount, 0);

  return {
    clinic_name: (clinic as { name?: string })?.name ?? "Flowmedi",
    clinic_address: (clinic as { address?: string })?.address ?? null,
    clinic_phone: (clinic as { phone?: string })?.phone ?? null,
    clinic_tax_id: (clinic as { tax_id?: string })?.tax_id ?? null,
    receipt_number: String(receipt.receipt_number),
    issued_at: String(receipt.issued_at),
    patient_name: (patient as { full_name?: string })?.full_name ?? "—",
    comanda_items: comandaDetails.items,
    subtotal_amount: comandaDetails.subtotal_amount,
    discount_amount:
      comandaDetails.discount_amount && comandaDetails.discount_amount > 0
        ? comandaDetails.discount_amount
        : null,
    lines,
    total_received: totalReceived,
    comanda_total: comandaDetails.total_amount,
    comanda_remainder: comandaDetails.remainder,
    voided: voided || !!receipt.voided_at,
  };
}

async function uploadReceiptPdf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  receiptNumber: string,
  pdfBuffer: Buffer
): Promise<string | null> {
  const year = new Date().getFullYear();
  const safeName = receiptNumber.replace(/[^\w-]/g, "_");
  const path = `${clinicId}/${year}/${safeName}.pdf`;

  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (error) {
    console.warn("[receipt-pdf] upload:", error.message);
    return null;
  }

  return path;
}

/** CORRIGIDO v2 — gera PDF real e persiste pdf_url no Storage. */
async function generateAndStoreReceiptPdf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  receiptId: string,
  paymentId: string,
  clinicId: string,
  receiptNumber: string,
  voided = false
) {
  const payload = await buildReceiptPdfPayload(supabase, receiptId, paymentId, voided);
  if (!payload) return null;

  try {
    const buffer = await renderReceiptPdfBuffer(payload);
    const storagePath = await uploadReceiptPdf(supabase, clinicId, receiptNumber, buffer);
    if (storagePath) {
      await supabase.from("receipts").update({ pdf_url: storagePath }).eq("id", receiptId);
      return storagePath;
    }
  } catch (e) {
    console.warn("[receipt-pdf] render:", e);
  }

  const fallback = `/dashboard/financeiro/recibo/${receiptId}`;
  await supabase.from("receipts").update({ pdf_url: fallback }).eq("id", receiptId);
  return fallback;
}

export async function generateReceiptForPayment(paymentId: string, comandaId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", receiptId: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", receiptId: null };
  if (
    profile.role !== "admin" &&
    profile.role !== "secretaria" &&
    profile.role !== "medico"
  ) {
    return { error: "Sem permissão.", receiptId: null };
  }

  const { data: existing } = await supabase
    .from("receipts")
    .select("id, receipt_number, voided_at, pdf_url")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (existing && !existing.voided_at) {
    return {
      error: null,
      receiptId: String(existing.id),
      receiptNumber: String(existing.receipt_number),
      pdfUrl: existing.pdf_url ? String(existing.pdf_url) : null,
    };
  }

  const { data: payment } = await supabase
    .from("patient_payments")
    .select("id, patient_id, comanda_id, amount, gross_amount, paid_at, plan_prepaid, payment_method")
    .eq("id", paymentId)
    .single();

  if (!payment) return { error: "Pagamento não encontrado.", receiptId: null };
  if (payment.plan_prepaid) {
    return { error: null, receiptId: null, receiptNumber: null, skipped: true };
  }

  const resolvedComandaId = comandaId ?? payment.comanda_id ?? null;

  const { count } = await supabase
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", profile.clinic_id);

  const seq = (count ?? 0) + 1;
  const year = new Date().getFullYear();
  const receiptNumber = `REC-${year}-${String(seq).padStart(5, "0")}`;

  const insertPayload: Record<string, unknown> = {
    clinic_id: profile.clinic_id,
    patient_id: payment.patient_id,
    payment_id: paymentId,
    receipt_number: receiptNumber,
    issued_at: payment.paid_at ?? new Date().toISOString(),
    created_by: user.id,
  };
  if (resolvedComandaId) insertPayload.comanda_id = resolvedComandaId;

  const { data: receipt, error } = await supabase
    .from("receipts")
    .insert(insertPayload)
    .select("id, receipt_number")
    .single();

  if (error) {
    if (error.message.includes("receipts")) {
      return { error: "Migration operational-flow-extensions não aplicada.", receiptId: null };
    }
    return { error: error.message, receiptId: null };
  }

  const pdfStoragePath = await generateAndStoreReceiptPdf(
    supabase,
    String(receipt.id),
    paymentId,
    profile.clinic_id,
    receiptNumber
  );

  try {
    const cashAmount = Number(payment.gross_amount ?? payment.amount ?? 0);
    const { data: eventId } = await supabase.rpc("create_event_timeline", {
      p_clinic_id: profile.clinic_id,
      p_event_code: "payment_receipt_generated",
      p_patient_id: payment.patient_id,
      p_metadata: {
        receipt_id: String(receipt.id),
        receipt_number: receiptNumber,
        pdf_storage_path: pdfStoragePath && isStoragePath(pdfStoragePath) ? pdfStoragePath : null,
        amount: cashAmount,
      },
    });
    if (eventId) {
      const { runAutoSendForEvent } = await import("@/lib/event-send-logic-server");
      const { isInsideAutoMessageWindow } = await import("@/lib/whatsapp-ops-controls");
      if (await isInsideAutoMessageWindow(profile.clinic_id, supabase)) {
        await runAutoSendForEvent(
          eventId,
          profile.clinic_id,
          "payment_receipt_generated",
          supabase
        );
      }
    }
  } catch (e) {
    console.warn("[payment_receipt_generated]", e);
  }

  revalidatePath("/dashboard/financeiro/receber");
  return {
    error: null,
    receiptId: String(receipt.id),
    receiptNumber: String(receipt.receipt_number),
    pdfUrl: pdfStoragePath,
  };
}

export async function voidReceiptsForPayment(paymentId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: receipts } = await supabase
    .from("receipts")
    .select("id, receipt_number, clinic_id, payment_id")
    .eq("payment_id", paymentId)
    .is("voided_at", null);

  await supabase
    .from("receipts")
    .update({ voided_at: now })
    .eq("payment_id", paymentId)
    .is("voided_at", null);

  for (const r of receipts ?? []) {
    await generateAndStoreReceiptPdf(
      supabase,
      String(r.id),
      String(r.payment_id),
      String(r.clinic_id),
      String(r.receipt_number),
      true
    );
  }

  return { error: null };
}

export async function resendReceiptPdf(receiptId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", pdfUrl: null as string | null };

  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, receipt_number, clinic_id, payment_id, voided_at")
    .eq("id", receiptId)
    .single();

  if (!receipt) return { error: "Recibo não encontrado.", pdfUrl: null };

  const pdfStoragePath = await generateAndStoreReceiptPdf(
    supabase,
    receiptId,
    String(receipt.payment_id),
    String(receipt.clinic_id),
    String(receipt.receipt_number),
    !!receipt.voided_at
  );

  return { error: null, pdfUrl: pdfStoragePath };
}

export async function getReceiptSignedUrl(receiptId: string): Promise<{
  url: string | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { url: null, error: "Clínica não encontrada." };

  const { data: receipt } = await supabase
    .from("receipts")
    .select("pdf_url, clinic_id")
    .eq("id", receiptId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!receipt?.pdf_url) return { url: null, error: "PDF não disponível." };

  const storagePath = toStoragePath(RECEIPTS_BUCKET, String(receipt.pdf_url));
  if (!storagePath) return { url: null, error: "PDF não disponível no storage." };

  return createAuthenticatedSignedUrl(supabase, RECEIPTS_BUCKET, storagePath);
}

export async function getReceiptPrintData(receiptId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: receipt } = await supabase
    .from("receipts")
    .select(
      `
      id,
      receipt_number,
      issued_at,
      voided_at,
      pdf_url,
      comanda_id,
      clinic_id,
      patient:patients ( full_name ),
      payment:patient_payments ( amount, gross_amount, payment_method, paid_at, comanda_id )
    `
    )
    .eq("id", receiptId)
    .single();

  if (!receipt) return { error: "Recibo não encontrado.", data: null };

  const patient = Array.isArray(receipt.patient) ? receipt.patient[0] : receipt.patient;
  const payment = Array.isArray(receipt.payment) ? receipt.payment[0] : receipt.payment;
  const pay = payment as {
    gross_amount?: number;
    amount?: number;
    payment_method?: string;
    paid_at?: string;
    comanda_id?: string;
  };

  const comandaId = receipt.comanda_id ?? pay.comanda_id ?? null;
  let creditApplied = 0;

  if (comandaId && pay.payment_method !== "credito_interno") {
    const { data: creditPayments } = await supabase
      .from("patient_payments")
      .select("amount, gross_amount, paid_at")
      .eq("comanda_id", comandaId)
      .eq("payment_method", "credito_interno");

    for (const cp of creditPayments ?? []) {
      const cpPaidAt = cp.paid_at ? new Date(cp.paid_at).getTime() : 0;
      const payPaidAt = pay.paid_at ? new Date(pay.paid_at).getTime() : 0;
      if (Math.abs(cpPaidAt - payPaidAt) < 120_000) {
        creditApplied += Number(cp.gross_amount ?? cp.amount);
      }
    }
  }

  const comandaDetails = await loadComandaReceiptDetails(supabase, comandaId);
  const cashAmount = Number(pay.gross_amount ?? pay.amount ?? 0);

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, address, phone, tax_id")
    .eq("id", receipt.clinic_id)
    .maybeSingle();

  return {
    error: null,
    data: {
      receipt_id: String(receipt.id),
      receipt_number: String(receipt.receipt_number),
      issued_at: String(receipt.issued_at),
      voided_at: receipt.voided_at ? String(receipt.voided_at) : null,
      pdf_url: receipt.pdf_url ? String(receipt.pdf_url) : null,
      clinic_name: clinic?.name ? String(clinic.name) : "Clínica",
      clinic_address: clinic?.address ? String(clinic.address) : null,
      clinic_phone: clinic?.phone ? String(clinic.phone) : null,
      clinic_tax_id: clinic?.tax_id ? String(clinic.tax_id) : null,
      patient_name: (patient as { full_name?: string })?.full_name ?? "—",
      amount: cashAmount,
      credit_applied: creditApplied > 0 ? creditApplied : null,
      payment_method: pay.payment_method ?? null,
      paid_at: pay.paid_at ?? null,
      comanda_items: comandaDetails.items,
      subtotal_amount: comandaDetails.subtotal_amount,
      discount_amount:
        comandaDetails.discount_amount && comandaDetails.discount_amount > 0
          ? comandaDetails.discount_amount
          : null,
      comanda_total: comandaDetails.total_amount,
      comanda_remainder: comandaDetails.remainder,
    },
  };
}

export async function getReceiptPrintDataByPaymentId(paymentId: string) {
  const supabase = await createClient();
  const { data: receipt } = await supabase
    .from("receipts")
    .select("id")
    .eq("payment_id", paymentId)
    .is("voided_at", null)
    .maybeSingle();

  if (!receipt) return { error: "Recibo não encontrado.", data: null };
  return getReceiptPrintData(String(receipt.id));
}

