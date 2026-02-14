"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Check, Loader2, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SecretaryOption = { id: string; full_name: string; email?: string };
type DoctorOption = { id: string; full_name: string };

export function SecretariasMedicosClient({
  clinicId,
  secretaries,
  doctors,
  initialAssignments,
}: {
  clinicId: string;
  secretaries: SecretaryOption[];
  doctors: DoctorOption[];
  initialAssignments: Record<string, string[]>;
}) {
  const router = useRouter();
  const [selectedSecretaryId, setSelectedSecretaryId] = useState<string>(
    secretaries[0]?.id ?? ""
  );
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<Set<string>>(() => {
    const sid = secretaries[0]?.id;
    if (!sid) return new Set();
    const ids = initialAssignments[sid] ?? [];
    return new Set(ids);
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const currentAssignments = initialAssignments[selectedSecretaryId] ?? [];
  const hasChanges =
    selectedDoctorIds.size !== currentAssignments.length ||
    currentAssignments.some((id) => !selectedDoctorIds.has(id)) ||
    [...selectedDoctorIds].some((id) => !currentAssignments.includes(id));

  const onSelectSecretary = (secretaryId: string) => {
    setSelectedSecretaryId(secretaryId);
    const ids = initialAssignments[secretaryId] ?? [];
    setSelectedDoctorIds(new Set(ids));
    setError(null);
  };

  const toggleDoctor = (doctorId: string) => {
    setSelectedDoctorIds((prev) => {
      const next = new Set(prev);
      if (next.has(doctorId)) next.delete(doctorId);
      else next.add(doctorId);
      return next;
    });
    setError(null);
  };

  const selectAllDoctors = () => setSelectedDoctorIds(new Set(doctors.map((d) => d.id)));
  const clearDoctors = () => setSelectedDoctorIds(new Set());

  async function handleSave() {
    if (!selectedSecretaryId) return;
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: delErr } = await supabase
        .from("secretary_doctors")
        .delete()
        .eq("clinic_id", clinicId)
        .eq("secretary_id", selectedSecretaryId);
      if (delErr) {
        setError(delErr.message);
        return;
      }
      const toInsert = [...selectedDoctorIds].map((doctor_id) => ({
        clinic_id: clinicId,
        secretary_id: selectedSecretaryId,
        doctor_id,
      }));
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from("secretary_doctors").insert(toInsert);
        if (insErr) {
          setError(insErr.message);
          return;
        }
      }
      router.refresh();
    });
  }

  if (secretaries.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Não há secretárias na equipe. Convide uma secretária em Equipe para configurar quais médicos ela atende.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-foreground">Secretária</h2>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="space-y-1">
            {secretaries.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelectSecretary(s.id)}
                  className={cn(
                    "w-full text-left rounded-md px-3 py-2 text-sm flex items-center gap-2 transition-colors",
                    selectedSecretaryId === s.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted/70 text-foreground"
                  )}
                >
                  <UserCircle className="h-4 w-4 shrink-0" />
                  <span className="truncate">{s.full_name || s.email || "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <h2 className="text-sm font-medium text-foreground">Médicos que esta secretária atende</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Se nenhum for marcado, ela verá todos os médicos na agenda.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAllDoctors}>
              Todos
            </Button>
            <Button variant="outline" size="sm" onClick={clearDoctors}>
              Nenhum
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {doctors.map((d) => {
              const checked = selectedDoctorIds.has(d.id);
              return (
                <label
                  key={d.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors",
                    checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDoctor(d.id)}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2",
                      checked ? "bg-primary border-primary" : "border-muted-foreground/50"
                    )}
                  >
                    {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />}
                  </div>
                  <span className="text-sm">{d.full_name}</span>
                </label>
              );
            })}
          </div>
          {doctors.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum médico na clínica. Convide em Equipe.</p>
          )}
          {hasChanges && (
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar alterações
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
