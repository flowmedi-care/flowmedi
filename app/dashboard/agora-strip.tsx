import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ClipboardList } from "lucide-react";

/**
 * Home “Agora” — só prioriza (Lei 7). Clicar leva ao Workspace/Pendências.
 */
export async function AgoraStrip({ clinicId }: { clinicId: string }) {
  const supabase = await createClient();

  const { data: cases } = await supabase
    .from("journey_cases")
    .select("id, pending_decision, contact_id")
    .eq("clinic_id", clinicId)
    .in("status", ["active", "waiting"])
    .not("pending_decision", "is", null)
    .limit(6);

  const pending = cases ?? [];
  const count = pending.length;

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
              <p className="text-2xl font-bold tabular-nums">{count}</p>
              <p className="text-xs text-muted-foreground">
                {count === 1
                  ? "pendência exige decisão"
                  : "pendências exigem decisão"}
              </p>
              {count > 0 && (
                <ul className="mt-2 space-y-1">
                  {pending.slice(0, 3).map((c) => {
                    const pd = c.pending_decision as { label?: string; type?: string } | null;
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
            <Link href="/dashboard/crm/jornada?view=pendencias">
              Ver pendências
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
