import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Rocket } from "lucide-react";
import { DemoAtendimentoButton } from "@/app/dashboard/demo-atendimento-button";

type Step = {
  id: string;
  label: string;
  href: string;
  done: boolean;
};

export async function SetupChecklist({ clinicId }: { clinicId: string }) {
  const supabase = await createClient();

  const [
    { count: teamCount },
    { data: waIntegration },
    { count: roomsCount },
    { count: servicesCount },
    { count: casesCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .neq("role", "system_admin"),
    supabase
      .from("clinic_integrations")
      .select("id, metadata")
      .eq("clinic_id", clinicId)
      .in("integration_type", ["whatsapp_meta", "whatsapp_simple"])
      .maybeSingle(),
    supabase
      .from("rooms")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId),
    supabase
      .from("journey_cases")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId),
  ]);

  const meta = (waIntegration?.metadata ?? {}) as { phone_number_id?: string };
  const waConnected = Boolean(waIntegration?.id && meta.phone_number_id);

  const steps: Step[] = [
    {
      id: "demo",
      label: "Ver uma pendência no Workspace (demo)",
      href: "/dashboard/pendencias",
      done: (casesCount ?? 0) > 0,
    },
    {
      id: "equipe",
      label: "Convidar equipe",
      href: "/dashboard/equipe",
      done: (teamCount ?? 0) > 1,
    },
    {
      id: "whatsapp",
      label: "Conectar WhatsApp (recomendado)",
      href: "/dashboard/configuracoes/integracoes",
      done: waConnected,
    },
    {
      id: "salas",
      label: "Cadastrar salas",
      href: "/dashboard/configuracoes/salas",
      done: (roomsCount ?? 0) > 0,
    },
    {
      id: "servicos",
      label: "Cadastrar serviços",
      href: "/dashboard/servicos-valores/servicos",
      done: (servicesCount ?? 0) > 0,
    },
  ];

  const remaining = steps.filter((s) => !s.done);
  if (remaining.length === 0) return null;

  return (
    <Card variant="flat" className="border-amber-500/30 bg-amber-500/[0.04]">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Primeiros passos</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Em minutos: crie um atendimento demo, veja a pendência e abra o Workspace — sem
              depender do WhatsApp Meta.
            </p>
          </div>
        </div>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.id}>
              <Link
                href={s.href}
                className="flex items-center gap-2 text-sm hover:text-primary"
              >
                {s.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={s.done ? "text-muted-foreground line-through" : ""}>
                  {s.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <DemoAtendimentoButton />
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/instrucoes/jornada-crm">Ver como funciona</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/pendencias">Ir para Pendências</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
