"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createStockCategory } from "@/lib/estoque/analytics";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import type { StockCategoryRow } from "@/lib/estoque/analytics";

export function EstoqueSidebar({
  categories,
  isAdmin,
}: {
  categories: StockCategoryRow[];
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const res = await createStockCategory(name.trim());
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Categoria criada.", "success");
      setShowAdd(false);
      setName("");
      router.refresh();
    }
  }

  return (
    <>
      <aside className="w-full lg:w-52 shrink-0 space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
          Categorias
        </p>
        {categories.map((cat) => {
          const href = `/dashboard/estoque/c/${cat.slug}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={cat.id}
              href={href}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
              )}
            >
              <span>{cat.name}</span>
              <span className="text-xs text-muted-foreground">{cat.product_count}</span>
            </Link>
          );
        })}
        {isAdmin && (
          <Button variant="ghost" size="sm" className="w-full justify-start mt-2" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar categoria
          </Button>
        )}
      </aside>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent title="Nova categoria" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Medicamentos" required />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Criando…" : "Criar categoria"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
