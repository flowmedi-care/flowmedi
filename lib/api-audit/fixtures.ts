import type { AuditConfigStatus, AuditFixtures } from "./types";

export function loadFixturesFromEnv(overrides?: Partial<AuditFixtures>): AuditFixtures {
  const cronSecret =
    process.env.API_AUDIT_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";

  const metaVerifyToken =
    process.env.API_AUDIT_META_VERIFY_TOKEN?.trim() ||
    process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ||
    "flowmedi-verify";

  return {
    clinicSlug: overrides?.clinicSlug ?? process.env.API_AUDIT_CLINIC_SLUG?.trim() ?? "demo",
    planId: overrides?.planId ?? process.env.API_AUDIT_PLAN_ID?.trim() ?? "00000000-0000-4000-8000-000000000001",
    conversationId:
      overrides?.conversationId ??
      process.env.API_AUDIT_CONVERSATION_ID?.trim() ??
      "00000000-0000-4000-8000-000000000002",
    appointmentId:
      overrides?.appointmentId ??
      process.env.API_AUDIT_APPOINTMENT_ID?.trim() ??
      "00000000-0000-4000-8000-000000000003",
    transcriptionId:
      overrides?.transcriptionId ??
      process.env.API_AUDIT_TRANSCRIPTION_ID?.trim() ??
      "00000000-0000-4000-8000-000000000004",
    formInstanceId:
      overrides?.formInstanceId ??
      process.env.API_AUDIT_FORM_INSTANCE_ID?.trim() ??
      "00000000-0000-4000-8000-000000000005",
    suggestionId:
      overrides?.suggestionId ??
      process.env.API_AUDIT_SUGGESTION_ID?.trim() ??
      "00000000-0000-4000-8000-000000000006",
    suggestionToken:
      overrides?.suggestionToken ??
      process.env.API_AUDIT_SUGGESTION_TOKEN?.trim() ??
      "00000000-0000-4000-8000-000000000007",
    clinicId:
      overrides?.clinicId ?? process.env.API_AUDIT_CLINIC_ID?.trim() ?? "00000000-0000-4000-8000-000000000008",
    patientId:
      overrides?.patientId ?? process.env.API_AUDIT_PATIENT_ID?.trim() ?? "00000000-0000-4000-8000-000000000009",
    contactSlug: overrides?.contactSlug ?? process.env.API_AUDIT_CONTACT_SLUG?.trim() ?? "demo",
    cronSecret: overrides?.cronSecret ?? cronSecret,
    metaVerifyToken: overrides?.metaVerifyToken ?? metaVerifyToken,
  };
}

export type RoleCredentials = {
  email: string;
  password: string;
};

export function loadRoleCredentials(role: string): RoleCredentials | null {
  const map: Record<string, [string | undefined, string | undefined]> = {
    admin: [process.env.API_AUDIT_ADMIN_EMAIL, process.env.API_AUDIT_ADMIN_PASSWORD],
    secretaria: [process.env.API_AUDIT_SECRETARIA_EMAIL, process.env.API_AUDIT_SECRETARIA_PASSWORD],
    medico: [process.env.API_AUDIT_MEDICO_EMAIL, process.env.API_AUDIT_MEDICO_PASSWORD],
    system_admin: [process.env.API_AUDIT_SYSTEM_ADMIN_EMAIL, process.env.API_AUDIT_SYSTEM_ADMIN_PASSWORD],
  };

  const [email, password] = map[role] ?? [undefined, undefined];
  if (!email?.trim() || !password?.trim()) return null;
  return { email: email.trim(), password: password.trim() };
}

export function getAuditConfigStatus(): AuditConfigStatus {
  return {
    supabase: !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    ),
    cronSecret: !!(
      process.env.API_AUDIT_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim()
    ),
    roleCredentials: {
      admin: !!loadRoleCredentials("admin"),
      secretaria: !!loadRoleCredentials("secretaria"),
      medico: !!loadRoleCredentials("medico"),
      system_admin: !!loadRoleCredentials("system_admin"),
    },
  };
}

export const FIXTURE_STORAGE_KEY = "api-audit-fixtures";
