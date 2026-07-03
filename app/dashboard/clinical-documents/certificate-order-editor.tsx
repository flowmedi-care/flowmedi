"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listCertificateCatalog, saveCertificateCatalogItem } from "./actions";
import type { CertificateCatalogItem } from "@/lib/clinical-documents/types";
import { Cid10Autocomplete } from "@/components/cid10-autocomplete";
import { toast } from "@/components/ui/toast";

type CertificateContent = {
  certificateBody: string;
  certificateDays?: number;
  certificateCid?: string;
  layoutId?: string;
};

export function CertificateOrderEditor({
  content,
  onChange,
}: {
  content: CertificateContent;
  onChange: (content: CertificateContent) => void;
}) {
  const [catalog, setCatalog] = useState<CertificateCatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [savingCatalog, setSavingCatalog] = useState(false);

  useEffect(() => {
    listCertificateCatalog().then((r) => {
      if (!r.error) setCatalog(r.data);
    });
  }, []);

  const filtered = catalog.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  function applyFromCatalog(item: CertificateCatalogItem) {
    onChange({
      ...content,
      certificateBody: item.default_body,
      certificateDays: item.default_days,
      certificateCid: item.default_cid,
    });
  }

  async function saveAsDefault() {
    const name = window.prompt("Nome do atestado padrão (ex.: Afastamento gripal)");
    if (!name?.trim()) return;
    setSavingCatalog(true);
    const res = await saveCertificateCatalogItem({
      scope: "doctor",
      name: name.trim(),
      default_body: content.certificateBody,
      default_days: content.certificateDays ?? 1,
      default_cid: content.certificateCid ?? "",
    });
    setSavingCatalog(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Atestado salvo em Meus atestados.", "success");
      listCertificateCatalog().then((r) => {
        if (!r.error) setCatalog(r.data);
      });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Meus atestados cadastrados</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Escolha um modelo salvo ou escreva o texto abaixo. Cadastre novos em Meu Perfil.
        </p>
        <Input
          placeholder="Buscar atestado..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 border rounded-lg bg-muted/20">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum atestado no catálogo.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => applyFromCatalog(c)}
                className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {c.name}
              </button>
            ))
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="cert-body">Texto do atestado *</Label>
        <Textarea
          id="cert-body"
          value={content.certificateBody}
          onChange={(e) => onChange({ ...content, certificateBody: e.target.value })}
          rows={8}
          placeholder="Atesto para os devidos fins que o(a) paciente..."
          className="mt-1"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="cert-days">Dias de afastamento</Label>
          <Input
            id="cert-days"
            type="number"
            min={1}
            value={content.certificateDays ?? 1}
            onChange={(e) =>
              onChange({ ...content, certificateDays: parseInt(e.target.value, 10) || 1 })
            }
            className="mt-1"
          />
        </div>
        <Cid10Autocomplete
          id="cert-cid"
          value={content.certificateCid ?? ""}
          onChange={(certificateCid) => onChange({ ...content, certificateCid })}
        />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={saveAsDefault}
        disabled={savingCatalog || !content.certificateBody.trim()}
      >
        {savingCatalog ? "Salvando..." : "Salvar como atestado padrão"}
      </Button>
    </div>
  );
}
