import { createClient } from "@/lib/supabase/server";
import type { UnifiedLedgerRow, ExpenseCategory } from "./types";
import { CATEGORY_LABELS } from "./constants";

type RawPayment = {
  id: string;
  amount: number;
  gross_amount: number | null;
  paid_at: string | null;
  created_at: string;
  payment_method: string | null;
  plan_prepaid: boolean | null;
  refunded_at: string | null;
  comanda_id: string | null;
  bank_account_id: string | null;
  comanda?: unknown;
};

type RawEntry = {
  id: string;
  entry_type: string;
  origin: string;
  description: string;
  amount: number;
  paid_at: string | null;
  due_date: string | null;
  created_at: string;
  status: string;
  category: string | null;
  payment_method: string | null;
  supplier_name: string | null;
  supplier_id: string | null;
  patient_id: string | null;
  comanda_id: string | null;
  bank_account_id: string | null;
  comanda?: unknown;
  supplier?: unknown;
  patient?: unknown;
};

function resolveName(relation: unknown, fallback: string | null): string {
  const r = Array.isArray(relation) ? relation[0] : relation;
  return (r as { full_name?: string; name?: string })?.full_name
    ?? (r as { name?: string })?.name
    ?? fallback
    ?? "—";
}

export async function fetchUnifiedLedger(
  clinicId: string,
  startIso: string,
  endIso: string
): Promise<UnifiedLedgerRow[]> {
  const supabase = await createClient();

  const [{ data: payments }, { data: entries }, { data: receipts }, { data: bankAccounts }] =
    await Promise.all([
      supabase
        .from("patient_payments")
        .select(
          `
          id, amount, gross_amount, paid_at, created_at, payment_method,
          plan_prepaid, refunded_at, comanda_id, bank_account_id,
          comanda:comandas (
            id,
            patient:patients ( full_name ),
            appointment:appointments (
              id,
              scheduled_at,
              service:services ( name )
            )
          )
        `
        )
        .eq("clinic_id", clinicId)
        .is("refunded_at", null)
        .gte("paid_at", startIso)
        .lte("paid_at", endIso),
      supabase
        .from("financial_entries")
        .select(
          `
          id, entry_type, origin, description, amount, paid_at, due_date, created_at,
          status, category, payment_method, supplier_name, supplier_id, patient_id,
          comanda_id, bank_account_id,
          supplier:suppliers ( name ),
          patient:patients ( full_name ),
          comanda:comandas ( appointment_id )
        `
        )
        .eq("clinic_id", clinicId)
        .eq("status", "pago")
        .gte("paid_at", startIso)
        .lte("paid_at", endIso),
      supabase
        .from("receipts")
        .select("id, payment_id")
        .eq("clinic_id", clinicId),
      supabase.from("bank_accounts").select("id, name").eq("clinic_id", clinicId),
    ]);

  const receiptByPayment = new Map<string, string>();
  for (const r of receipts ?? []) {
    if (r.payment_id) receiptByPayment.set(r.payment_id as string, r.id as string);
  }

  const bankMap = new Map<string, string>();
  for (const b of bankAccounts ?? []) {
    bankMap.set(b.id as string, b.name as string);
  }

  const rows: Omit<UnifiedLedgerRow, "running_balance">[] = [];

  for (const p of (payments ?? []) as RawPayment[]) {
    if (p.plan_prepaid) continue;
    if (p.payment_method === "credito_interno") continue;
    const occurred = p.paid_at ?? p.created_at;
    const comanda = Array.isArray(p.comanda) ? p.comanda[0] : p.comanda;
    const appt = comanda
      ? Array.isArray((comanda as { appointment?: unknown }).appointment)
        ? (comanda as { appointment: unknown[] }).appointment[0]
        : (comanda as { appointment?: unknown }).appointment
      : null;
    const service = appt
      ? Array.isArray((appt as { service?: unknown }).service)
        ? (appt as { service: unknown[] }).service[0]
        : (appt as { service?: unknown }).service
      : null;
    const patient = comanda
      ? Array.isArray((comanda as { patient?: unknown }).patient)
        ? (comanda as { patient: unknown[] }).patient[0]
        : (comanda as { patient?: unknown }).patient
      : null;

    rows.push({
      id: `pay-${p.id}`,
      source: "payment",
      occurred_at: occurred,
      type: "inflow",
      amount: Number(p.gross_amount ?? p.amount),
      counterparty: (patient as { full_name?: string })?.full_name ?? "Paciente",
      counterparty_type: "patient",
      source_label: (service as { name?: string })?.name ?? "Consulta",
      description: "Pagamento de comanda",
      payment_method: p.payment_method,
      bank_account_name: p.bank_account_id ? bankMap.get(p.bank_account_id) ?? null : null,
      comanda_id: p.comanda_id,
      appointment_id: (appt as { id?: string })?.id ?? null,
      patient_payment_id: p.id,
      financial_entry_id: null,
      receipt_id: receiptByPayment.get(p.id) ?? null,
      category: null,
      patient_id: (patient as { id?: string })?.id ?? null,
    });
  }

  for (const e of (entries ?? []) as RawEntry[]) {
    if (!e.paid_at) continue;
    const isInflow = e.entry_type === "receita";
    const entryComanda = Array.isArray(e.comanda) ? e.comanda[0] : e.comanda;
    rows.push({
      id: `entry-${e.id}`,
      source: "entry",
      occurred_at: e.paid_at,
      type: isInflow ? "inflow" : "outflow",
      amount: Number(e.amount),
      counterparty: isInflow
        ? resolveName(e.patient, null)
        : resolveName(e.supplier, e.supplier_name),
      counterparty_type: isInflow ? "patient" : e.supplier_id ? "supplier" : "other",
      source_label: e.category ? CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category : e.origin,
      description: e.description,
      payment_method: e.payment_method,
      bank_account_name: e.bank_account_id ? bankMap.get(e.bank_account_id) ?? null : null,
      comanda_id: e.comanda_id,
      appointment_id: (entryComanda as { appointment_id?: string })?.appointment_id ?? null,
      patient_payment_id: null,
      financial_entry_id: e.id,
      receipt_id: null,
      category: e.category as ExpenseCategory | null,
      patient_id: e.patient_id,
    });
  }

  rows.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  let balance = 0;
  const chronological = [...rows].reverse();
  const withBalance: UnifiedLedgerRow[] = [];
  for (const r of chronological) {
    balance += r.type === "inflow" ? r.amount : -r.amount;
    withBalance.push({ ...r, running_balance: balance });
  }

  return withBalance.reverse();
}

