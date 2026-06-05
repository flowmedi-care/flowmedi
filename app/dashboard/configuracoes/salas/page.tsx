import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listRooms } from "../room-actions";
import { SalasClient } from "./salas-client";

export default async function SalasPage() {
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
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const { rooms } = await listRooms(false);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Salas e consultórios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre os espaços físicos usados no agendamento.
        </p>
      </div>
      <SalasClient initialRooms={rooms} />
    </div>
  );
}
