"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getClinicEmailBranding, updateClinicEmailBranding } from "../actions";
import { Mail } from "lucide-react";

const VARIANTS = [
  "{{nome_clinica}}",
  "{{telefone_clinica}}",
  "{{endereco_clinica}}",
];

export function EmailBrandingCard() {
  const [emailHeader, setEmailHeader] = useState("");
  const [emailFooter, setEmailFooter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getClinicEmailBranding().then((res) => {
      setLoading(false);
      if (res.error) setError(res.error);
      else if (res.data) {
        setEmailHeader(res.data.email_header ?? "");
        setEmailFooter(res.data.email_footer ?? "");
      }
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await updateClinicEmailBranding(
      emailHeader.trim() || null,
      emailFooter.trim() || null
    );
    setSaving(false);
    if (res.error) setError(res.error);
  }

  if (loading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Cabeçalho e rodapé dos emails
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Aplicados a todos os emails enviados pela clínica. Use as variáveis:{" "}
              {VARIANTS.join(", ")}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <div>
          <Label htmlFor="email_header">Cabeçalho (opcional)</Label>
          <Textarea
            id="email_header"
            value={emailHeader}
            onChange={(e) => setEmailHeader(e.target.value)}
            placeholder="Ex.: &lt;div style=\"font-size:12px;color:#666;\">{{nome_clinica}} | {{telefone_clinica}}&lt;/div&gt;"
            rows={3}
            className="mt-1 font-mono text-sm"
          />
        </div>
        <div>
          <Label htmlFor="email_footer">Rodapé (opcional)</Label>
          <Textarea
            id="email_footer"
            value={emailFooter}
            onChange={(e) => setEmailFooter(e.target.value)}
            placeholder="Ex.: &lt;div style=\"margin-top:24px;font-size:11px;color:#999;\">Este é um email automático. Em caso de dúvidas, entre em contato com a clínica.&lt;/div&gt;"
            rows={3}
            className="mt-1 font-mono text-sm"
          />
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}
