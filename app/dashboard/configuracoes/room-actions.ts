"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type RoomRow = {
  id: string;
  name: string;
  active: boolean;
  display_order: number;
};

export async function listRooms(activeOnly = false): Promise<{
  error: string | null;
  rooms: RoomRow[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", rooms: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", rooms: [] };

  let query = supabase
    .from("rooms")
    .select("id, name, active, display_order")
    .eq("clinic_id", profile.clinic_id)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (activeOnly) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) {
    if (error.message.includes("rooms")) {
      return { error: null, rooms: [] };
    }
    return { error: error.message, rooms: [] };
  }

  return {
    error: null,
    rooms: (data ?? []).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      active: !!r.active,
      display_order: Number(r.display_order) || 0,
    })),
  };
}

export async function createRoom(name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };
  if (profile.role !== "admin") return { error: "Sem permissão." };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Informe o nome da sala." };

  const { count } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", profile.clinic_id);

  const { error } = await supabase.from("rooms").insert({
    clinic_id: profile.clinic_id,
    name: trimmed,
    display_order: count ?? 0,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes/salas");
  revalidatePath("/dashboard/agenda");
  return { error: null };
}

export async function updateRoom(
  roomId: string,
  data: { name?: string; active?: boolean; display_order?: number }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };
  if (profile.role !== "admin") return { error: "Sem permissão." };

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.active !== undefined) payload.active = data.active;
  if (data.display_order !== undefined) payload.display_order = data.display_order;

  const { error } = await supabase
    .from("rooms")
    .update(payload)
    .eq("id", roomId)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes/salas");
  revalidatePath("/dashboard/agenda");
  return { error: null };
}
