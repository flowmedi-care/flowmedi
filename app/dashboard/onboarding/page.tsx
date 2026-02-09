import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (profile) redirect("/dashboard");

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <h1 className="text-xl font-semibold text-foreground mb-2">
        Criar sua clínica
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Você será o administrador. Depois poderá convidar médicos e
        secretárias.
      </p>
      <OnboardingForm />
    </div>
  );
}
