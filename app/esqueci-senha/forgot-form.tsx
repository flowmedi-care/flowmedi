"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string };

      if (!res.ok || !data.success) {
        setError(data.message ?? "Não foi possível enviar o link. Tente novamente.");
        setLoading(false);
        return;
      }

      setSuccessMessage(
        data.message ??
          "Se este e-mail estiver cadastrado, enviaremos um link para redefinir a senha."
      );
    } catch {
      setError("Não foi possível enviar o link. Tente novamente.");
    }
    setLoading(false);
  }

  if (successMessage) {
    return (
      <p className="text-sm text-foreground bg-primary/10 text-primary p-4 rounded-md">
        {successMessage}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Enviando…" : "Enviar link"}
      </Button>
    </form>
  );
}
