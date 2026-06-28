import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { addRecurrenceInterval } from "@/lib/financeiro/recurrence";
import { categoryToDreSection } from "@/lib/financeiro/constants";
import type { ExpenseCategory } from "@/lib/financeiro/types";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * Cron: materializa próximo lançamento de séries financeiras recorrentes.
 * GET /api/cron/financial-recurrence?secret=...
 */
export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronSecret(request);
    if (authError) return authError;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, { status: 500 });
    }

    const supabase = createServiceRoleClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: seriesList, error } = await supabase
      .from("financial_entry_series")
      .select("*")
      .eq("active", true)
      .lte("next_due_date", today);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let created = 0;
    let skipped = 0;

    for (const series of seriesList ?? []) {
      const nextDue = series.next_due_date as string;
      if (!nextDue || nextDue > today) continue;

      const endMode = series.end_mode as string;
      if (endMode === "until_date" && series.end_date && nextDue > (series.end_date as string)) {
        await supabase.from("financial_entry_series").update({ active: false }).eq("id", series.id);
        continue;
      }
      if (
        endMode === "count" &&
        series.end_count &&
        Number(series.generated_count) >= Number(series.end_count)
      ) {
        await supabase.from("financial_entry_series").update({ active: false }).eq("id", series.id);
        continue;
      }

      const { data: existing } = await supabase
        .from("financial_entries")
        .select("id")
        .eq("series_id", series.id)
        .eq("due_date", nextDue)
        .maybeSingle();

      if (existing) {
        skipped++;
        const newNext = addRecurrenceInterval(
          nextDue,
          series.frequency as "daily" | "weekly" | "monthly",
          Number(series.interval_count ?? 1)
        );
        await supabase
          .from("financial_entry_series")
          .update({ next_due_date: newNext, generated_count: Number(series.generated_count) + 1 })
          .eq("id", series.id);
        continue;
      }

      const category = series.category as ExpenseCategory | null;
      const { error: insertErr } = await supabase.from("financial_entries").insert({
        clinic_id: series.clinic_id,
        entry_type: series.entry_type,
        origin: series.entry_type === "despesa" ? "supplier" : "manual",
        description: series.description,
        amount: series.amount,
        due_date: nextDue,
        competence_date: nextDue,
        supplier_id: series.supplier_id,
        category,
        dre_section: category ? categoryToDreSection(category) : null,
        status: "pendente",
        series_id: series.id,
        series_index: Number(series.generated_count) + 1,
        created_by: series.created_by,
      });

      if (insertErr) {
        console.error("[cron/financial-recurrence]", series.id, insertErr);
        continue;
      }

      created++;
      const newNext = addRecurrenceInterval(
        nextDue,
        series.frequency as "daily" | "weekly" | "monthly",
        Number(series.interval_count ?? 1)
      );
      const newCount = Number(series.generated_count) + 1;
      const shouldDeactivate =
        (endMode === "count" && series.end_count && newCount >= Number(series.end_count)) ||
        (endMode === "until_date" && series.end_date && newNext > (series.end_date as string));

      await supabase
        .from("financial_entry_series")
        .update({
          next_due_date: shouldDeactivate ? null : newNext,
          generated_count: newCount,
          active: !shouldDeactivate,
        })
        .eq("id", series.id);
    }

    return NextResponse.json({ ok: true, created, skipped, processed: (seriesList ?? []).length });
  } catch (e) {
    console.error("[cron/financial-recurrence]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
