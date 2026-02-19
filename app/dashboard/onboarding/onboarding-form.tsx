"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function OnboardingForm({ initialFullName = "" }: { initialFullName?: string }) {
  const router = useRouter();
  const [clinicName, setClinicName] = useState("");
  const [fullName, setFullName] = useState(initialFullName);
  const [clinicPhone, setClinicPhone] = useState("");
  const [clinicEmail, setClinicEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { data: clinicId, error: rpcErr } = await supabase.rpc("create_clinic_and_profile", {
      p_clinic_name: clinicName,
      p_full_name: fullName || null,
      p_clinic_phone: clinicPhone.trim() || null,
      p_clinic_email: clinicEmail.trim() || null,
    });

    if (rpcErr || !clinicId) {
      setError(rpcErr?.message ?? "Erro ao criar clínica");
      setLoading(false);
      return;
    }

    // Aguardar um pouco para garantir que o banco de dados foi atualizado
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verificar se o profile foi atualizado corretamente
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role, clinic_id")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin" || profile?.clinic_id !== clinicId) {
        console.error("Profile não foi atualizado corretamente:", profile);
        setError("Erro ao atualizar perfil. Por favor, recarregue a página.");
        setLoading(false);
        return;
      }
    }

    // Forçar refresh completo e redirecionar
    // Usar window.location para garantir reload completo do servidor
    router.refresh();
    // Pequeno delay para garantir que o refresh seja processado
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 100);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="clinicName">Nome da clínica *</Label>
        <Input
          id="clinicName"
          type="text"
          placeholder="Ex.: Clínica Saúde"
          value={clinicName}
          onChange={(e) => setClinicName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="clinicPhone">Telefone da clínica</Label>
        <Input
          id="clinicPhone"
          type="tel"
          placeholder="(11) 99999-9999"
          value={clinicPhone}
          onChange={(e) => setClinicPhone(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Será usado nos cabeçalhos e rodapés dos emails
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="clinicEmail">Email da clínica</Label>
        <Input
          id="clinicEmail"
          type="email"
          placeholder="contato@clinica.com"
          value={clinicEmail}
          onChange={(e) => setClinicEmail(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Será usado nos cabeçalhos e rodapés dos emails
        </p>
      </div>
      {!initialFullName && (
        <div className="space-y-2">
          <Label htmlFor="fullName">Seu nome completo</Label>
          <Input
            id="fullName"
            type="text"
            placeholder="Seu nome"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Criando…" : "Criar clínica e continuar"}
      </Button>
    </form>
  );
}
