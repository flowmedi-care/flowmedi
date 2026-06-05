"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AtendimentoClient } from "./atendimento-client";

export function ConsultaTabsClient({
  appointmentId,
  appointmentValor,
  canEditOperacional,
}: {
  appointmentId: string;
  appointmentValor: number | null;
  canEditOperacional: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "formularios" || tab === "exames") {
      router.replace(`/dashboard/agenda/atendimento/${appointmentId}`, { scroll: false });
      return;
    }
    if (tab === "consulta" || tab === "paciente" || tab === "operacional") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      const qs = params.toString();
      router.replace(
        `/dashboard/agenda/consulta/${appointmentId}${qs ? `?${qs}` : ""}`,
        { scroll: false }
      );
    }
  }, [searchParams, appointmentId, router]);

  return (
    <AtendimentoClient
      appointmentId={appointmentId}
      appointmentValor={appointmentValor}
      canEdit={canEditOperacional}
      autoFinalize={searchParams.get("operacional") === "1"}
      autoStart={searchParams.get("autostart") === "1"}
      mode="full"
    />
  );
}
