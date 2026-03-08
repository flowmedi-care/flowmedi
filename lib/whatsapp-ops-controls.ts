import type { SupabaseClient } from "@supabase/supabase-js";

type ClinicOpsConfig = {
  whatsapp_monthly_post24h_limit: number | null;
  auto_message_send_start: string | null;
  auto_message_send_end: string | null;
  auto_message_timezone: string | null;
};

type LimitStatus = {
  limit: number | null;
  used: number;
  remaining: number | null;
  blocked: boolean;
};

function parseTimeToMinutes(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return fallback;
  }
  return h * 60 + m;
}

function getMinutesInTimeZone(now: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function isInsideWindow(nowMinutes: number, startMinutes: number, endMinutes: number): boolean {
  // Janela normal: 08:00 -> 20:00
  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }
  // Janela atravessando meia-noite: 22:00 -> 06:00
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

export async function getClinicOpsConfig(
  clinicId: string,
  supabase: SupabaseClient
): Promise<ClinicOpsConfig> {
  const { data } = await supabase
    .from("clinics")
    .select(
      "whatsapp_monthly_post24h_limit, auto_message_send_start, auto_message_send_end, auto_message_timezone"
    )
    .eq("id", clinicId)
    .maybeSingle();

  return {
    whatsapp_monthly_post24h_limit:
      typeof data?.whatsapp_monthly_post24h_limit === "number"
        ? data.whatsapp_monthly_post24h_limit
        : null,
    auto_message_send_start: data?.auto_message_send_start ?? null,
    auto_message_send_end: data?.auto_message_send_end ?? null,
    auto_message_timezone: data?.auto_message_timezone ?? "America/Sao_Paulo",
  };
}

export async function isInsideAutoMessageWindow(
  clinicId: string,
  supabase: SupabaseClient,
  now = new Date()
): Promise<boolean> {
  const config = await getClinicOpsConfig(clinicId, supabase);
  const timezone = config.auto_message_timezone || "America/Sao_Paulo";
  const startMinutes = parseTimeToMinutes(config.auto_message_send_start, 8 * 60);
  const endMinutes = parseTimeToMinutes(config.auto_message_send_end, 20 * 60);
  const nowMinutes = getMinutesInTimeZone(now, timezone);
  return isInsideWindow(nowMinutes, startMinutes, endMinutes);
}

export async function getCurrentPost24hLimitStatus(
  clinicId: string,
  supabase: SupabaseClient,
  now = new Date()
): Promise<LimitStatus> {
  const config = await getClinicOpsConfig(clinicId, supabase);
  const limit =
    typeof config.whatsapp_monthly_post24h_limit === "number" &&
    config.whatsapp_monthly_post24h_limit >= 0
      ? config.whatsapp_monthly_post24h_limit
      : null;

  const monthStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const { count } = await supabase
    .from("whatsapp_post24h_usage")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .gte("created_at", monthStartUtc.toISOString())
    .lt("created_at", nextMonthStartUtc.toISOString());

  const used = count ?? 0;
  if (limit === null) {
    return { limit: null, used, remaining: null, blocked: false };
  }
  const remaining = Math.max(0, limit - used);
  return { limit, used, remaining, blocked: used >= limit };
}

export async function hasRecentPost24hUsageForPhone(
  clinicId: string,
  phoneNumber: string,
  supabase: SupabaseClient,
  now = new Date()
): Promise<boolean> {
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { data } = await supabase
    .from("whatsapp_post24h_usage")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("phone_number", phoneNumber)
    .gte("created_at", last24h.toISOString())
    .limit(1);
  return Boolean(data && data.length > 0);
}

export async function recordPost24hUsage(
  params: {
    clinicId: string;
    conversationId?: string | null;
    phoneNumber: string;
    source: "event_auto" | "event_manual";
    eventCode?: string | null;
  },
  supabase: SupabaseClient
): Promise<void> {
  await supabase.from("whatsapp_post24h_usage").insert({
    clinic_id: params.clinicId,
    conversation_id: params.conversationId ?? null,
    phone_number: params.phoneNumber,
    source: params.source,
    event_code: params.eventCode ?? null,
  });
}
