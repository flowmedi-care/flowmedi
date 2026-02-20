"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export function ConviteAcceptClient({
  token,
  clinicName,
  roleLabel,
  inviteEmail,
}: {
  token: string;
  clinicName: string;
  roleLabel: string;
  inviteEmail?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function acceptAndRedirect() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("accept_invite", { p_token: token });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
    router.push("/dashboard");
  }

  useEffect(() => {
    acceptAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading && !error) {
    return (
      <div className="text-center max-w-md space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Aceitando convite...</h1>
        <p className="text-muted-foreground">
          Vinculando sua conta a <strong>{clinicName}</strong> como <strong>{roleLabel}</strong>.
        </p>
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="text-center max-w-md space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Aceitar convite</h1>
      <p className="text-muted-foreground">
        Você entrará em <strong>{clinicName}</strong> como <strong>{roleLabel}</strong>.
      </p>
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>
      )}
      <Button onClick={acceptAndRedirect} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Tentar novamente
      </Button>
      <p className="text-xs text-muted-foreground">
        {inviteEmail ? (
          <>Este convite foi enviado para <strong>{inviteEmail}</strong>. Use essa conta para aceitar.</>
        ) : (
          <>Sua conta será vinculada à clínica ao continuar.</>
        )}
      </p>
    </div>
  );
}
