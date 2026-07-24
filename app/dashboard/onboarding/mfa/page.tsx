import { redirect } from "next/navigation";

/** MFA removido — onboarding segue direto ao dashboard. */
export default function OnboardingMfaPage() {
  redirect("/dashboard");
}
