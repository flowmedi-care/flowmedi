"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ProfileDimensionValueColor = {
  dimension_value_id: string;
  cor: string;
};

export async function getProfileDimensionValueColors(): Promise<{
  data: ProfileDimensionValueColor[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Não autorizado." };

  const { data, error } = await supabase
    .from("profile_dimension_value_colors")
    .select("dimension_value_id, cor")
    .eq("profile_id", user.id);

  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) => ({ dimension_value_id: r.dimension_value_id, cor: r.cor })),
    error: null,
  };
}

export async function setProfileDimensionValueColors(
  overrides: { dimension_value_id: string; cor: string }[]
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  await supabase
    .from("profile_dimension_value_colors")
    .delete()
    .eq("profile_id", user.id);

  if (overrides.length > 0) {
    const rows = overrides
      .filter((o) => o.cor && /^#[0-9A-Fa-f]{6}$/.test(o.cor))
      .map((o) => ({
        profile_id: user.id,
        dimension_value_id: o.dimension_value_id,
        cor: o.cor,
      }));
    const { error } = await supabase.from("profile_dimension_value_colors").insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/perfil");
  revalidatePath("/dashboard/agenda");
  return { error: null };
}
