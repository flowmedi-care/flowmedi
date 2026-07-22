import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ClipboardList } from "lucide-react";
import { pendingRequiresHumanDecision } from "@/lib/case-management/next-action";
import type { PendingDecision } from "@/lib/case-management/types";

/**
 * Agora = view (não módulo, sem estado próprio).
 * Deriva dos Cases cuja próxima ação exige decisão humana.
 */
export async function AgoraStrip({ clinicId }: { clinicId: string }) {
  const supabase = await createClient();

  const { count } = await supabase
    .from("journey_cases")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .in("status", ["active", "waiting"])
    .not("pending_decision", "is", null);

  const { data: cases } = await supabase
    .from("journey_cases")
    .select("id, pending_decision, contact_id")
    .eq("clinic_id", clinicId)
    .in("status", ["active", "waiting"])
    .not("pending_decision", "is", null)
    .order("updated_at", { ascending: false })
    .limit(5);

  const humanPending = (cases ?? []).filter((c) =>
    pendingRequiresHumanDecision(c.pending_decision as PendingDecision | null)
  );

  // Count approximate: prefer exact count when all pending are human; else filter sample
  const totalCount = count ?? humanPending.length;

  return (
    <Card variant="flat" className="border-primary/30 bg-primary/[0.04]">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Agora</p>
              <p className="text-2xl font-bold tabular-nums">{totalCount}</p>
              <p className="text-xs text-muted-foreground">
                {totalCount === 1
                  ? "atendimento com próxima ação humana"
                  : "atendimentos com próxima ação humana"}
              </p>
              {humanPending.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {humanPending.slice(0, 3).map((c) => {
                    const pd = c.pending_decision as {
                      label?: string;
                      type?: string;
                    } | null;
                    const label = pd?.label || pd?.type || "Decisão pendente";
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/dashboard/crm/jornada/${c.id}`}
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {label}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          <Button size="sm" asChild>
            <Link href="/dashboard/hoje?focus=pendencias">
              Ver pendências
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
