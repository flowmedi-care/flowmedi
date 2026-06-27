"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const CONTACTS_PATH = "/dashboard/contatos";

export type SupplierRow = {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
};

export async function listSuppliers() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as SupplierRow[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };
  if (profile.role === "medico") return { error: "Sem permissão.", data: [] };

  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, document, email, phone, notes, active")
    .eq("clinic_id", profile.clinic_id)
    .eq("active", true)
    .order("name");

  if (error) return { error: error.message, data: [] };
  return { error: null, data: (data ?? []) as SupplierRow[] };
}

export async function createSupplier(data: {
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}) {
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

  const { error } = await supabase.from("suppliers").insert({
    clinic_id: profile.clinic_id,
    name: data.name.trim(),
    document: data.document?.trim() || null,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    notes: data.notes?.trim() || null,
  });

  if (error) return { error: error.message };
  revalidatePath(`${CONTACTS_PATH}/fornecedores`);
  return { error: null };
}

export async function listBirthdaysToday() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name, email, phone, birth_date")
    .eq("clinic_id", profile.clinic_id)
    .not("birth_date", "is", null);

  if (error) return { error: error.message, data: [] };

  const matches = (data ?? []).filter((p) => {
    if (!p.birth_date) return false;
    const d = new Date(p.birth_date + "T12:00:00");
    return d.getMonth() + 1 === month && d.getDate() === day;
  });

  return { error: null, data: matches };
}

export type UnifiedContactType = "paciente" | "lead" | "fornecedor" | "profissional";

export type UnifiedContact = {
  id: string;
  primaryType: UnifiedContactType;
  /** @deprecated Use primaryType */
  type: UnifiedContactType;
  tags: string[];
  name: string;
  email: string | null;
  phone: string | null;
  href: string | null;
};

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const n = email.trim().toLowerCase();
  return n || null;
}

export async function listAllContacts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as UnifiedContact[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };

  const clinicId = profile.clinic_id;

  const [{ data: patients }, { data: leads }, { data: suppliers }, { data: doctors }] =
    await Promise.all([
      supabase
        .from("patients")
        .select("id, full_name, email, phone")
        .eq("clinic_id", clinicId)
        .order("full_name"),
      supabase
        .from("non_registered_pipeline")
        .select("id, name, email, phone, stage")
        .eq("clinic_id", clinicId)
        .neq("stage", "cadastrado")
        .order("name"),
      supabase
        .from("suppliers")
        .select("id, name, email, phone")
        .eq("clinic_id", clinicId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("clinic_id", clinicId)
        .eq("role", "medico")
        .eq("active", true)
        .order("full_name"),
    ]);

  const leadEmails = new Set(
    (leads ?? [])
      .map((l) => normalizeEmail(l.email))
      .filter((e): e is string => !!e)
  );

  const items: UnifiedContact[] = [];

  for (const p of patients ?? []) {
    const emailNorm = normalizeEmail(p.email);
    const tags: string[] = ["Paciente"];
    if (emailNorm && leadEmails.has(emailNorm)) {
      tags.push("Lead ativo");
    }
    items.push({
      id: p.id,
      primaryType: "paciente",
      type: "paciente",
      tags,
      name: p.full_name,
      email: p.email,
      phone: p.phone,
      href: `/dashboard/contatos/pacientes/${p.id}`,
    });
  }

  const patientEmails = new Set(
    (patients ?? [])
      .map((p) => normalizeEmail(p.email))
      .filter((e): e is string => !!e)
  );

  for (const l of leads ?? []) {
    const emailNorm = normalizeEmail(l.email);
    if (emailNorm && patientEmails.has(emailNorm)) continue;

    items.push({
      id: l.id,
      primaryType: "lead",
      type: "lead",
      tags: ["Lead"],
      name: l.name ?? "Sem nome",
      email: l.email,
      phone: l.phone,
      href: "/dashboard/contatos/leads",
    });
  }

  for (const s of suppliers ?? []) {
    items.push({
      id: s.id,
      primaryType: "fornecedor",
      type: "fornecedor",
      tags: ["Fornecedor"],
      name: s.name,
      email: s.email,
      phone: s.phone,
      href: "/dashboard/contatos/fornecedores",
    });
  }

  for (const d of doctors ?? []) {
    items.push({
      id: d.id,
      primaryType: "profissional",
      type: "profissional",
      tags: ["Profissional"],
      name: d.full_name ?? "Profissional",
      email: d.email,
      phone: null,
      href: `/dashboard/contatos/profissionais/${d.id}`,
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { error: null, data: items };
}
