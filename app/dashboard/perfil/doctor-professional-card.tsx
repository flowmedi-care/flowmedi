"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDoctorProfessionalInfo } from "../clinical-documents/actions";

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

function formatCpfInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function DoctorProfessionalCard({
  initialCpf,
  initialCrm,
  initialCrmUf,
  initialSpecialty,
}: {
  initialCpf: string | null;
  initialCrm: string | null;
  initialCrmUf: string | null;
  initialSpecialty: string | null;
}) {
  const [cpf, setCpf] = useState(initialCpf ?? "");
  const [crm, setCrm] = useState(initialCrm ?? "");
  const [crmUf, setCrmUf] = useState(initialCrmUf ?? "");
  const [specialty, setSpecialty] = useState(initialSpecialty ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCpf(initialCpf ?? "");
    setCrm(initialCrm ?? "");
    setCrmUf(initialCrmUf ?? "");
    setSpecialty(initialSpecialty ?? "");
  }, [initialCpf, initialCrm, initialCrmUf, initialSpecialty]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await updateDoctorProfessionalInfo({
      cpf,
      crm,
      crm_uf: crmUf,
      specialty,
    });
    setSaving(false);
    if (res.error) setError(res.error);
    else setSaved(true);
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Dados profissionais</h2>
        <p className="text-sm text-muted-foreground">
          Usados no rodapé de receitas e pedidos de exame. O CPF é necessário apenas para
          assinatura digital com certificado ICP.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
        )}
        {saved && (
          <p className="text-sm text-green-600">Dados salvos com sucesso.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="doctor-crm">CRM</Label>
            <Input id="doctor-crm" value={crm} onChange={(e) => setCrm(e.target.value)} placeholder="123456" />
          </div>
          <div>
            <Label htmlFor="doctor-crm-uf">UF do CRM</Label>
            <select
              id="doctor-crm-uf"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={crmUf}
              onChange={(e) => setCrmUf(e.target.value)}
            >
              <option value="">Selecione</option>
              {UF_OPTIONS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="doctor-specialty">Especialidade (opcional)</Label>
            <Input
              id="doctor-specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="doctor-cpf">CPF (assinatura digital)</Label>
            <Input
              id="doctor-cpf"
              value={formatCpfInput(cpf)}
              onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
              placeholder="000.000.000-00"
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar dados profissionais"}
        </Button>
      </CardContent>
    </Card>
  );
}
