"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createRoom, updateRoom, type RoomRow } from "../room-actions";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

export function SalasClient({ initialRooms }: { initialRooms: RoomRow[] }) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await createRoom(newName);
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Sala criada.", "success");
      setNewName("");
      router.refresh();
    }
  }

  async function toggleActive(room: RoomRow) {
    const res = await updateRoom(room.id, { active: !room.active });
    if (res.error) toast(res.error, "error");
    else {
      setRooms((prev) =>
        prev.map((r) => (r.id === room.id ? { ...r, active: !r.active } : r))
      );
      toast(room.active ? "Sala desativada." : "Sala ativada.", "success");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Nova sala</h2>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            placeholder="Ex.: Consultório 1"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={handleCreate} disabled={saving || !newName.trim()}>
            Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Salas cadastradas</h2>
          <p className="text-sm text-muted-foreground">
            Com salas ativas, o agendamento exige escolher consultório e valida conflito por sala.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma sala. Sem salas, o limite global de consultórios simultâneos (configuração da
              clínica) continua valendo.
            </p>
          ) : (
            rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <span className="font-medium">{room.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={room.active ? "default" : "secondary"}>
                    {room.active ? "Ativa" : "Inativa"}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(room)}
                  >
                    {room.active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
