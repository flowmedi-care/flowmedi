"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { createSupplier, type SupplierRow } from "../actions";
import { Plus, Building2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { FilterBar } from "@/components/dashboard-ui/layout/filter-bar";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import {
  ContactCard,
  ContactCardGrid,
  ContactCardBadge,
} from "@/components/dashboard-ui/contact-card";
import { formatPhoneBr } from "@/lib/format-phone";

export function FornecedoresClient({
  initialSuppliers,
  canManage,
}: {
  initialSuppliers: SupplierRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detailSupplier, setDetailSupplier] = useState<SupplierRow | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialSuppliers;
    return initialSuppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.document && s.document.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")))
    );
  }, [initialSuppliers, search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast("Informe o nome do fornecedor.", "error");
      return;
    }
    setSaving(true);
    const res = await createSupplier({
      name,
      document: document || null,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
    });
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Fornecedor cadastrado.", "success");
      setOpen(false);
      setName("");
      setDocument("");
      setEmail("");
      setPhone("");
      setNotes("");
      router.refresh();
    }
  }

  return (
    <>
      <PageShell
        header={{
          breadcrumbs: [{ label: "Fornecedores" }],
          title: "Fornecedores",
          description: "Cadastro de fornecedores para despesas e contas a pagar.",
          actions: canManage ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo fornecedor
            </Button>
          ) : undefined,
        }}
        toolbar={
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar por nome, documento, e-mail ou telefone..."
          />
        }
      >
        <p className="text-sm font-medium text-muted-foreground mb-4">
          {filtered.length} fornecedor(es)
        </p>
        {filtered.length === 0 ? (
          <EmptyState
            title={search ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
            description={
              search
                ? "Tente outro termo de busca."
                : "Use em lançamentos de despesa no Financeiro."
            }
          />
        ) : (
          <ContactCardGrid>
            {filtered.map((s) => (
              <ContactCard
                key={s.id}
                name={s.name}
                subtitle={
                  [s.document, s.email].filter(Boolean).join(" · ") || "Sem documento"
                }
                detail={
                  [s.phone ? formatPhoneBr(s.phone) : null, s.notes]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                badges={
                  s.document ? <ContactCardBadge>{s.document}</ContactCardBadge> : undefined
                }
                onClick={() => setDetailSupplier(s)}
              />
            ))}
          </ContactCardGrid>
        )}
      </PageShell>

      <Dialog open={!!detailSupplier} onOpenChange={(v) => !v && setDetailSupplier(null)}>
        <DialogContent>
          {detailSupplier && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{detailSupplier.name}</h2>
                  <p className="text-sm text-muted-foreground">Detalhes do fornecedor</p>
                </div>
              </div>
              <dl className="grid gap-3 text-sm">
                {detailSupplier.document && (
                  <div>
                    <dt className="text-muted-foreground">CNPJ/CPF</dt>
                    <dd className="font-medium">{detailSupplier.document}</dd>
                  </div>
                )}
                {detailSupplier.email && (
                  <div>
                    <dt className="text-muted-foreground">E-mail</dt>
                    <dd className="font-medium">{detailSupplier.email}</dd>
                  </div>
                )}
                {detailSupplier.phone && (
                  <div>
                    <dt className="text-muted-foreground">Telefone</dt>
                    <dd className="font-medium">{formatPhoneBr(detailSupplier.phone)}</dd>
                  </div>
                )}
                {detailSupplier.notes && (
                  <div>
                    <dt className="text-muted-foreground">Observações</dt>
                    <dd>{detailSupplier.notes}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <h2 className="text-lg font-semibold mb-4">Novo fornecedor</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="document">CNPJ/CPF</Label>
              <Input id="document" value={document} onChange={(e) => setDocument(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="notes">Observações</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
