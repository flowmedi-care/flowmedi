import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EstoqueSidebar } from "./estoque-sidebar";
import { listStockCategories, seedDefaultStockCategories } from "@/lib/estoque/analytics";

export default async function EstoqueLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "medico") redirect("/dashboard");

  let { data: categories } = await listStockCategories();
  if (!categories.length && profile.clinic_id) {
    await seedDefaultStockCategories(profile.clinic_id, supabase);
    const res = await listStockCategories();
    categories = res.data;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <EstoqueSidebar categories={categories} isAdmin={profile.role === "admin"} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
