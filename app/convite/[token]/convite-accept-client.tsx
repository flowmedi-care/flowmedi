"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export function ConviteAcceptClient({
  token,
  clinicName,
  roleLabel,
}: {
  token: string;
  clinicName: string;
  roleLabel: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
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

  return (
    <div className="text-center max-w-md space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Aceitar convite</h1>
      <p className="text-muted-foreground">
        Você entrará em <strong>{clinicName}</strong> como <strong>{roleLabel}</strong>.
      </p>
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>
      )}
      <Button onClick={handleAccept} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Continuar para o dashboard
      </Button>
      <p className="text-xs text-muted-foreground">
        Você já está logado. Ao continuar, sua conta será vinculada à clínica.
      </p>
    </div>
  );
}
