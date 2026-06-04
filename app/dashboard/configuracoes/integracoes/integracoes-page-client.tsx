"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { IntegrationsSection } from "../integrations-section";

export function IntegracoesPageClient({
  clinicId,
  canUseWhatsApp,
  canUseEmail,
}: {
  clinicId: string;
  canUseWhatsApp: boolean;
  canUseEmail: boolean;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const integration = searchParams.get("integration");
    const status = searchParams.get("status");

    if (integration === "whatsapp" && status && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("integration");
      url.searchParams.delete("status");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte WhatsApp, e-mail e outros canais à sua clínica.
        </p>
      </div>
      <IntegrationsSection
        clinicId={clinicId}
        canUseWhatsApp={canUseWhatsApp}
        canUseEmail={canUseEmail}
      />
    </div>
  );
}
