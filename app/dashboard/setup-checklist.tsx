import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Rocket, Sparkles } from "lucide-react";
import { getOnboardingState } from "@/lib/onboarding/state";
import { ANCHOR_PHRASE, POST_AHA_CTAS } from "@/lib/onboarding/copy";
import { clinicProgressPercent } from "@/lib/onboarding/clinic-progress";
import { PurgeDemoButton } from "@/components/onboarding/purge-demo-button";

type Step = {
  id: string;
  label: string;
  href: string;
  done: boolean;
};

export async function SetupChecklist({ clinicId }: { clinicId: string }) {
  const supabase = await createClient();
  const onboarding = await getOnboardingState(supabase, clinicId);

  // Pré-aha: card único de ativação
  if (onboarding?.isActive || (onboarding && !onboarding.ahaCompletedAt && onboarding.tourStep !== "skipped")) {
    const percent = clinicProgressPercent(onboarding.tourStep);
    const caseHref = onboarding.bundle?.caseId
      ? `/dashboard/crm/jornada/${onboarding.bundle.caseId}?tour=1`
      : "/dashboard/onboarding/tour";

    return (
      <Card variant="flat" className="border-primary/25 bg-primary/[0.04]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Ver sua clínica funcionando</p>
              <p className="text-xs text-muted-foreground mt-0.5">{ANCHOR_PHRASE}</p>
              {onboarding.demoSeededAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Progresso da clínica: {percent}%
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link href={caseHref}>
                {onboarding.demoSeededAt ? "Continuar ativação" : "Começar com a Maria"}
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/instrucoes/jornada-crm">Ver como funciona</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Skipped sem aha: permitir retomar
  if (onboarding?.tourStep === "skipped" && !onboarding.ahaCompletedAt) {
    return (
      <Card variant="flat" className="border-amber-500/30 bg-amber-500/[0.04]">
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold">Retomar ativação</p>
          <p className="text-xs text-muted-foreground">
            Você pulou o tour. Em poucos minutos dá para ver a clínica rodando com a Maria.
          </p>
          <Button size="sm" asChild>
            <Link href="/dashboard/onboarding/tour">Ver clínica funcionando</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const [
    { count: teamCount },
    { data: waIntegration },
    { count: servicesCount },
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
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId),
  ]);

  const meta = (waIntegration?.metadata ?? {}) as { phone_number_id?: string };
  const waConnected = Boolean(waIntegration?.id && meta.phone_number_id);

  const steps: Step[] = [
    {
      id: "equipe",
      label: "Convidar equipe",
      href: "/dashboard/equipe",
      done: (teamCount ?? 0) > 1,
    },
    {
      id: "servicos",
      label: "Cadastrar serviços reais",
      href: "/dashboard/servicos-valores/servicos",
      done: (servicesCount ?? 0) > 1,
    },
    {
      id: "whatsapp",
      label: "Conectar WhatsApp",
      href: "/dashboard/configuracoes/integracoes",
      done: waConnected,
    },
  ];

  const remaining = steps.filter((s) => !s.done);
  const showPostAha = Boolean(onboarding?.ahaCompletedAt) || remaining.length > 0;
  if (!showPostAha) return null;
  if (remaining.length === 0 && !onboarding?.bundle) return null;

  return (
    <Card variant="flat" className="border-amber-500/30 bg-amber-500/[0.04]">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {onboarding?.ahaCompletedAt
                ? "Transformar na clínica real"
                : "Primeiros passos"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {onboarding?.ahaCompletedAt
                ? "Agora é sua vez. Substitua a Maria pelos seus primeiros pacientes reais."
                : "Configure o essencial para operar no dia a dia."}
            </p>
          </div>
        </div>
        <ul className="space-y-2">
          {(remaining.length ? remaining : steps).map((s) => (
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
          {POST_AHA_CTAS.slice(0, 2).map((cta) => (
            <Button key={cta.id} size="sm" variant="outline" asChild>
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          ))}
          {onboarding?.bundle && <PurgeDemoButton />}
        </div>
      </CardContent>
    </Card>
  );
}
