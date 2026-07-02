"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

const REQUEST_TYPES = [
  { value: "access", label: "Acesso aos meus dados" },
  { value: "correction", label: "Correção de dados" },
  { value: "deletion", label: "Eliminação de dados" },
  { value: "portability", label: "Portabilidade" },
  { value: "opposition", label: "Oposição ao tratamento" },
  { value: "other", label: "Outro pedido (art. 18)" },
];

export function PrivacidadeTitularForm() {
  const [clinicSlug, setClinicSlug] = useState("");
  const [requestType, setRequestType] = useState("access");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/public/dsar/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_slug: clinicSlug.trim().toLowerCase(),
          request_type: requestType,
          requester_name: requesterName.trim(),
          requester_email: requesterEmail.trim(),
          requester_phone: requesterPhone.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
        due_at?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Erro ao enviar solicitação.");
        return;
      }

      const dueLabel = data.due_at
        ? new Date(data.due_at).toLocaleDateString("pt-BR")
        : null;
      setSuccess(
        `${data.message ?? "Solicitação registrada."}${
          dueLabel ? ` Prazo estimado de resposta: ${dueLabel}.` : ""
        }`
      );
      setRequesterName("");
      setRequesterEmail("");
      setRequesterPhone("");
      setNotes("");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border p-6 bg-card">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>
      )}
      {success && (
        <p className="text-sm text-foreground bg-primary/10 p-2 rounded-md">{success}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="clinic_slug">
          Identificador da clínica <span className="text-destructive">*</span>
        </Label>
        <Input
          id="clinic_slug"
          value={clinicSlug}
          onChange={(e) => setClinicSlug(e.target.value)}
          placeholder="ex.: clinica-saude"
          required
        />
        <p className="text-xs text-muted-foreground">
          Informe o identificador da clínica (slug do site ou subdomínio). Em caso de dúvida,
          contate a clínica diretamente.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Tipo de solicitação</Label>
        <Select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
          {REQUEST_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">
          Seu nome <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={requesterName}
          onChange={(e) => setRequesterName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">
          E-mail <span className="text-destructive">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          value={requesterEmail}
          onChange={(e) => setRequesterEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefone</Label>
        <Input
          id="phone"
          type="tel"
          value={requesterPhone}
          onChange={(e) => setRequesterPhone(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Detalhes da solicitação</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Descreva o que você precisa..."
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? "Enviando…" : "Enviar solicitação"}
      </Button>
    </form>
  );
}
