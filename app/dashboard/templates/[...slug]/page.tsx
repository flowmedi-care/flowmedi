import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LegacyTemplatesCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
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

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { slug } = await params;
  const suffix = slug.length > 0 ? `/${slug.join("/")}` : "";
  redirect(`/dashboard/mensagens/templates${suffix}`);
}
