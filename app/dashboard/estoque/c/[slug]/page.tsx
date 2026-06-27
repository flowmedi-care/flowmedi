import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { listProductsByCategorySlug, listSuppliersForStock } from "../../actions";
import { EstoqueCategoryClient } from "../../estoque-category-client";

export default async function EstoqueCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "medico") redirect("/dashboard");

  const [{ category, data, error }, { data: suppliers }] = await Promise.all([
    listProductsByCategorySlug(slug),
    listSuppliersForStock(),
  ]);

  if (!category) notFound();

  return (
    <>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      <EstoqueCategoryClient
        categoryName={category.name as string}
        categoryId={category.id as string}
        initialProducts={data}
        suppliers={suppliers ?? []}
        isAdmin={profile.role === "admin"}
      />
    </>
  );
}
