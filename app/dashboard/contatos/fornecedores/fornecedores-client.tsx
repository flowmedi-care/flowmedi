"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { createSupplier, type SupplierRow } from "../actions";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { AppPageHeader } from "@/components/app-page-header";
import { ListPanel, ListPanelItem } from "@/components/dashboard-ui/list-panel";
import { EmptyState } from "@/components/dashboard-ui/empty-state";

export function FornecedoresClient({
  initialSuppliers,
  canManage,
}: {
  initialSuppliers: SupplierRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

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
    <div className="space-y-6">
      <AppPageHeader
        breadcrumbs={[{ label: "Fornecedores" }]}
        title="Fornecedores"
        description="Cadastro de fornecedores para despesas e contas a pagar."
        actions={
          canManage ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo fornecedor
            </Button>
          ) : undefined
        }
      />

      <div className="surface-elevated p-4 sm:p-6">
        <p className="text-sm font-medium text-muted-foreground mb-4">
          {initialSuppliers.length} fornecedor(es)
        </p>
        {initialSuppliers.length === 0 ? (
          <EmptyState
            title="Nenhum fornecedor cadastrado"
            description="Use em lançamentos de despesa no Financeiro."
          />
        ) : (
          <ListPanel>
            {initialSuppliers.map((s) => (
              <ListPanelItem key={s.id}>
                <div>
                  <p className="font-medium">{s.name}</p>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {s.document && <span>{s.document}</span>}
                    {s.email && <span>{s.email}</span>}
                    {s.phone && <span>{s.phone}</span>}
                  </div>
                  {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
                </div>
              </ListPanelItem>
            ))}
          </ListPanel>
        )}
      </div>

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
    </div>
  );
}
