import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendEmail, checkEmailIntegration } from "@/lib/comunicacao/email";

type GoalConfig = {
  targetConfirmationPct: number;
  targetAttendancePct: number;
  targetNoShowPct: number;
  targetOccupancyPct: number;
  targetReturnPct: number;
};

type AppointmentLite = {
  id: string;
  status: string;
  patient_id: string | null;
  scheduled_at: string;
};

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function defaultGoals(): GoalConfig {
  return {
    targetConfirmationPct: 85,
    targetAttendancePct: 80,
    targetNoShowPct: 8,
    targetOccupancyPct: 75,
    targetReturnPct: 60,
  };
}

function buildHtmlEmail(input: {
  clinicName: string;
  periodLabel: string;
  vitorias: string[];
  riscos: string[];
  acoes: string[];
}): { html: string; text: string } {
  const listToHtml = (items: string[]) => items.map((i) => `<li>${i}</li>`).join("");
  const listToText = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2>Briefing Executivo Semanal</h2>
      <p><strong>Clínica:</strong> ${input.clinicName}</p>
      <p><strong>Período:</strong> ${input.periodLabel}</p>
      <h3>3 Vitórias</h3>
      <ul>${listToHtml(input.vitorias)}</ul>
      <h3>3 Riscos</h3>
      <ul>${listToHtml(input.riscos)}</ul>
      <h3>3 Ações para hoje</h3>
      <ul>${listToHtml(input.acoes)}</ul>
      <p style="margin-top: 16px; color: #555;">Gerado automaticamente pelo FlowMedi.</p>
    </div>
  `;
  const text = [
    "Briefing Executivo Semanal",
    `Clínica: ${input.clinicName}`,
    `Período: ${input.periodLabel}`,
    "",
    "3 Vitórias",
    listToText(input.vitorias),
    "",
    "3 Riscos",
    listToText(input.riscos),
    "",
    "3 Ações para hoje",
    listToText(input.acoes),
    "",
    "Gerado automaticamente pelo FlowMedi.",
  ].join("\n");
  return { html, text };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function subDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - days);
  return x;
}

async function computeBriefingForClinic(
  clinicId: string,
  goals: GoalConfig
): Promise<{ vitorias: string[]; riscos: string[]; acoes: string[] }> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const start7 = startOfDay(subDays(now, 7));
  const start30 = startOfDay(subDays(now, 30));
  const end = endOfDay(now);

  const [{ data: appointmentsLast30 }, { data: appointmentsFuture7 }, { data: messageLog7 }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, status, patient_id, scheduled_at, valor")
      .eq("clinic_id", clinicId)
      .gte("scheduled_at", start30.toISOString())
      .lte("scheduled_at", end.toISOString()),
    supabase
      .from("appointments")
      .select("id, status, patient_id, scheduled_at")
      .eq("clinic_id", clinicId)
      .in("status", ["agendada", "confirmada"])
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", endOfDay(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)).toISOString()),
    supabase
      .from("message_log")
      .select("id")
      .eq("clinic_id", clinicId)
      .gte("sent_at", start7.toISOString())
      .lte("sent_at", end.toISOString()),
  ]);

  const rows30 = appointmentsLast30 ?? [];
  const rows7 = rows30.filter((a) => new Date(a.scheduled_at) >= start7);

  const conf30 = pct(
    rows30.filter((a) => a.status === "confirmada" || a.status === "realizada" || a.status === "falta").length,
    rows30.length
  );
  const conf7 = pct(
    rows7.filter((a) => a.status === "confirmada" || a.status === "realizada" || a.status === "falta").length,
    rows7.length
  );
  const noShow30 = pct(rows30.filter((a) => a.status === "falta").length, rows30.length);
  const noShow7 = pct(rows7.filter((a) => a.status === "falta").length, rows7.length);
  const attendance30 = pct(rows30.filter((a) => a.status === "realizada").length, rows30.length);
  const attendance7 = pct(rows7.filter((a) => a.status === "realizada").length, rows7.length);

  const perdas = rows7.filter((a) => a.status === "falta" || a.status === "cancelada");
  const realizadas7 = rows7.filter((a) => a.status === "realizada");
  const ticketMedio7 =
    realizadas7.length > 0
      ? realizadas7.reduce((acc, a) => acc + Math.max(0, Number(a.valor ?? 0)), 0) / realizadas7.length
      : 0;
  const receitaPerdida7 = perdas.reduce((acc, a) => {
    const valor = Number(a.valor ?? 0);
    return acc + (valor > 0 ? valor : ticketMedio7);
  }, 0);

  // Risco simples: pacientes com historico de falta/cancelamento e agenda futura.
  const futureByPatient = new Set((appointmentsFuture7 ?? []).map((a) => a.patient_id).filter(Boolean));
  const historicoRuimPorPaciente = new Map<string, number>();
  (rows30 as AppointmentLite[]).forEach((a) => {
    if (!a.patient_id) return;
    if (a.status === "falta" || a.status === "cancelada") {
      historicoRuimPorPaciente.set(a.patient_id, (historicoRuimPorPaciente.get(a.patient_id) ?? 0) + 1);
    }
  });
  let pacientesRisco = 0;
  futureByPatient.forEach((pid) => {
    if ((historicoRuimPorPaciente.get(pid as string) ?? 0) >= 1) pacientesRisco++;
  });

  const vitorias: string[] = [];
  if (conf7 >= goals.targetConfirmationPct) {
    vitorias.push(`Confirmação em ${conf7}% (meta ${goals.targetConfirmationPct}%).`);
  }
  if (noShow7 <= goals.targetNoShowPct) {
    vitorias.push(`No-show controlado em ${noShow7}% (meta <= ${goals.targetNoShowPct}%).`);
  }
  if (attendance7 >= goals.targetAttendancePct) {
    vitorias.push(`Comparecimento em ${attendance7}% (meta ${goals.targetAttendancePct}%).`);
  }
  if (conf7 >= conf30) {
    vitorias.push(`Confirmação melhorou vs 30 dias (${conf7}% vs ${conf30}%).`);
  }
  if (noShow7 <= noShow30) {
    vitorias.push(`No-show melhorou vs 30 dias (${noShow7}% vs ${noShow30}%).`);
  }

  const riscos: string[] = [];
  if (conf7 < goals.targetConfirmationPct) riscos.push(`Confirmação abaixo da meta: ${conf7}% (${goals.targetConfirmationPct}%).`);
  if (noShow7 > goals.targetNoShowPct) riscos.push(`No-show acima da meta: ${noShow7}% (${goals.targetNoShowPct}%).`);
  if (attendance7 < goals.targetAttendancePct) riscos.push(`Comparecimento abaixo da meta: ${attendance7}% (${goals.targetAttendancePct}%).`);
  if (pacientesRisco > 0) riscos.push(`${pacientesRisco} pacientes com risco de no-show têm consulta nos próximos 7 dias.`);
  if (receitaPerdida7 > 0) riscos.push(`Perda estimada da semana em faltas/cancelamentos: ${formatCurrency(receitaPerdida7)}.`);

  const acoes: string[] = [];
  if (conf7 < goals.targetConfirmationPct) acoes.push("Reforçar confirmação ativa das próximas 48h por WhatsApp e ligação.");
  if (pacientesRisco > 0) acoes.push("Priorizar contato manual dos pacientes de maior risco ainda hoje.");
  if (noShow7 > goals.targetNoShowPct) acoes.push("Aplicar rotina de reconfirmação D-1 e D-0 para consultas críticas.");
  if ((messageLog7 ?? []).length < 20) acoes.push("Aumentar cadência de lembretes automáticos para elevar comparecimento.");
  if (receitaPerdida7 > 0) acoes.push("Oferecer encaixe de recuperação para preencher janelas abertas desta semana.");

  const fill = (items: string[], fallback: string) =>
    items.slice(0, 3).concat(items.length >= 3 ? [] : [fallback]).slice(0, 3);

  return {
    vitorias: fill(vitorias, "Operação estável na semana monitorada."),
    riscos: fill(riscos, "Sem riscos críticos adicionais fora do monitoramento padrão."),
    acoes: fill(acoes, "Manter monitoramento diário de confirmação, faltas e ociosidade."),
  };
}

/**
 * Cron semanal: envia briefing executivo por e-mail para o admin da clínica.
 * Proteção via CRON_SECRET (Authorization: Bearer <CRON_SECRET>).
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "") || request.nextUrl.searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret && token !== expectedSecret) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const clinicId = request.nextUrl.searchParams.get("clinic_id");

    const clinicsQuery = supabase
      .from("clinics")
      .select("id, name")
      .order("created_at", { ascending: true });
    const { data: clinics, error: clinicsError } = clinicId
      ? await clinicsQuery.eq("id", clinicId)
      : await clinicsQuery;
    if (clinicsError) return NextResponse.json({ error: clinicsError.message }, { status: 500 });

    const results: Array<{ clinic_id: string; status: "sent" | "skipped" | "error"; detail: string }> = [];
    for (const clinic of clinics ?? []) {
      const { data: admin } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("clinic_id", clinic.id)
        .eq("role", "admin")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!admin?.email) {
        results.push({ clinic_id: clinic.id, status: "skipped", detail: "Admin sem e-mail cadastrado." });
        continue;
      }

      const emailIntegration = await checkEmailIntegration(clinic.id, supabase);
      if (!emailIntegration.connected) {
        results.push({ clinic_id: clinic.id, status: "skipped", detail: "Integração de e-mail não conectada." });
        continue;
      }

      const { data: goalsRow } = await supabase
        .from("clinic_report_goals")
        .select("target_confirmation_pct,target_attendance_pct,target_no_show_pct,target_occupancy_pct,target_return_pct")
        .eq("clinic_id", clinic.id)
        .maybeSingle();
      const d = defaultGoals();
      const goals: GoalConfig = {
        targetConfirmationPct: Number(goalsRow?.target_confirmation_pct ?? d.targetConfirmationPct),
        targetAttendancePct: Number(goalsRow?.target_attendance_pct ?? d.targetAttendancePct),
        targetNoShowPct: Number(goalsRow?.target_no_show_pct ?? d.targetNoShowPct),
        targetOccupancyPct: Number(goalsRow?.target_occupancy_pct ?? d.targetOccupancyPct),
        targetReturnPct: Number(goalsRow?.target_return_pct ?? d.targetReturnPct),
      };

      const briefing = await computeBriefingForClinic(clinic.id, goals);
      const periodLabel = `${subDays(new Date(), 7).toLocaleDateString("pt-BR")} a ${new Date().toLocaleDateString("pt-BR")}`;
      const { html, text } = buildHtmlEmail({
        clinicName: clinic.name ?? "Clínica",
        periodLabel,
        ...briefing,
      });

      const sendResult = await sendEmail(
        clinic.id,
        {
          to: admin.email,
          subject: `Briefing semanal - ${clinic.name ?? "FlowMedi"}`,
          body: text,
          html,
        },
        supabase
      );

      if (!sendResult.success) {
        results.push({
          clinic_id: clinic.id,
          status: "error",
          detail: sendResult.error || "Falha ao enviar e-mail.",
        });
        continue;
      }

      await supabase.from("message_log").insert({
        clinic_id: clinic.id,
        patient_id: null,
        appointment_id: null,
        channel: "email",
        type: "executive_briefing_weekly",
        metadata: {
          admin_id: admin.id,
          admin_email: admin.email,
          period_days: 7,
          vitorias: briefing.vitorias,
          riscos: briefing.riscos,
          acoes: briefing.acoes,
        },
      });

      results.push({ clinic_id: clinic.id, status: "sent", detail: `Enviado para ${admin.email}.` });
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      sent: results.filter((r) => r.status === "sent").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/weekly-executive-briefing]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
