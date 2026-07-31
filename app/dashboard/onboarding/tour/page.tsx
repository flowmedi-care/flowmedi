import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { seedClinicDemoBundle } from "@/lib/onboarding/seed";
import { trackProductEvent } from "@/lib/onboarding/events";
import { ACTIVATION_SPLASH } from "@/lib/onboarding/copy";

export default async function OnboardingTourBootstrapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) redirect("/dashboard/onboarding");
  if (profile.role !== "admin") redirect("/dashboard");

  await trackProductEvent(supabase, {
    clinicId: profile.clinic_id,
    userId: user.id,
    event: "clinic_created",
    properties: { source: "tour_bootstrap" },
  });

  const seeded = await seedClinicDemoBundle(supabase, {
    clinicId: profile.clinic_id,
    adminUserId: profile.id,
    adminFullName: profile.full_name,
  });

  if (seeded.error || !seeded.caseId) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">Não foi possível iniciar a demonstração</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {seeded.error ?? "Tente novamente em instantes."}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Se as colunas de ativação ainda não existem no banco, execute a migration{" "}
          <code className="rounded bg-muted px-1">migration-onboarding-activation.sql</code>.
        </p>
        <a href="/dashboard" className="mt-6 inline-block text-sm text-primary underline">
          Ir ao dashboard
        </a>
      </div>
    );
  }

  redirect(`/dashboard/crm/jornada/${seeded.caseId}?tour=1`);
}

/** Splash estático — o redirect acontece no server; este export evita flash vazio em edge cases. */
export function ActivationSplashFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <p className="max-w-sm text-center text-sm text-muted-foreground">{ACTIVATION_SPLASH}</p>
    </div>
  );
}
