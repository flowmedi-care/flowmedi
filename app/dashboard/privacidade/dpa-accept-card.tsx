"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { recordDpaAcceptance } from "@/lib/compliance/dpa-actions";
import { getDpaDocumentUrl } from "@/lib/compliance/dpa";
import { createClient } from "@/lib/supabase/client";

export function DpaAcceptCard({
  accepted,
  acceptedAt,
  currentVersion,
  signedVersion,
}: {
  accepted: boolean;
  acceptedAt: string | null;
  currentVersion: string;
  signedVersion: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [localAccepted, setLocalAccepted] = useState(accepted);

  function handleAccept() {
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast("Sessão expirada.", "error");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("id", user.id)
        .single();
      if (!profile?.clinic_id) {
        toast("Clínica não encontrada.", "error");
        return;
      }
      const res = await recordDpaAcceptance(profile.clinic_id);
      if (res.error) {
        toast(res.error, "error");
        return;
      }
      setLocalAccepted(true);
      toast("DPA aceito com sucesso.", "success");
    });
  }

  return (
    <Card className={!localAccepted ? "border-amber-500/40" : undefined}>
      <CardHeader>
        <CardTitle className="text-base">Acordo de Tratamento de Dados (DPA)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {localAccepted ? (
          <p className="text-muted-foreground">
            DPA versão <strong className="text-foreground">{signedVersion ?? currentVersion}</strong>{" "}
            aceito
            {acceptedAt
              ? ` em ${new Date(acceptedAt).toLocaleDateString("pt-BR")}`
              : ""}
            .
          </p>
        ) : (
          <>
            <p className="text-muted-foreground">
              Aceite o DPA vigente (versão {currentVersion}) para formalizar o papel de operador do
              FlowMed e suas obrigações como controladora.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={pending} onClick={handleAccept}>
                Aceitar DPA
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={getDpaDocumentUrl()} target="_blank">
                  Ler DPA
                </Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
