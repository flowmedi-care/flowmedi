"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function OnboardingForm({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [clinicName, setClinicName] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { data: clinic, error: clinicErr } = await supabase
      .from("clinics")
      .insert({ name: clinicName })
      .select("id")
      .single();

    if (clinicErr || !clinic) {
      setError(clinicErr?.message ?? "Erro ao criar clínica");
      setLoading(false);
      return;
    }

    const { error: profileErr } = await supabase.from("profiles").insert({
      id: userId,
      email: userEmail,
      full_name: fullName || null,
      role: "admin",
      clinic_id: clinic.id,
    });

    if (profileErr) {
      setError(profileErr.message);
      setLoading(false);
      return;
    }

    router.refresh();
    router.push("/dashboard");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="clinicName">Nome da clínica</Label>
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
        <Label htmlFor="fullName">Seu nome completo</Label>
        <Input
          id="fullName"
          type="text"
          placeholder="Seu nome"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Criando…" : "Criar clínica e continuar"}
      </Button>
    </form>
  );
}
