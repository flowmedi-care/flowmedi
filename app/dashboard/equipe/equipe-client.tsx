"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { UserPlus, Trash2, Copy, Loader2 } from "lucide-react";

type Member = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  created_at: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  medico: "Médico",
  secretaria: "Secretária",
};

export function EquipeClient({
  clinicId,
  members,
  invites,
  currentUserId,
}: {
  clinicId: string;
  members: Member[];
  invites: Invite[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"medico" | "secretaria">("medico");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteLink(null);
    setLoading(true);
    const supabase = createClient();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: err } = await supabase.from("invites").insert({
      clinic_id: clinicId,
      email: email.trim(),
      role,
      token,
      created_by: currentUserId,
      expires_at: expiresAt,
    });

    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setInviteLink(`${origin}/convite/${token}`);
    setEmail("");
    router.refresh();
  }

  function copyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    router.refresh();
  }

  async function handleRemove(profileId: string) {
    if (!confirm("Remover acesso desta pessoa? Ela não poderá mais entrar na clínica. Os dados de consultas e pacientes permanecem.")) return;
    setRemovingId(profileId);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("deactivate_profile", { p_profile_id: profileId });
    setRemovingId(null);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  async function cancelInvite(inviteId: string) {
    const supabase = createClient();
    await supabase.from("invites").delete().eq("id", inviteId);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <h2 className="font-medium text-foreground">Convidar pessoa</h2>
          <p className="text-sm text-muted-foreground">
            Envie o link para a pessoa entrar ou criar conta. Ela será vinculada à clínica com o papel escolhido.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>
          )}
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-4">
            <div className="space-y-2 min-w-[200px]">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 min-w-[140px]">
              <Label htmlFor="role">Papel</Label>
              <select
                id="role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={role}
                onChange={(e) => setRole(e.target.value as "medico" | "secretaria")}
              >
                <option value="medico">Médico</option>
                <option value="secretaria">Secretária</option>
              </select>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Gerar link
            </Button>
          </form>
          {inviteLink && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Link do convite (válido 7 dias):</span>
              <code className="text-xs bg-muted px-2 py-1 rounded break-all">{inviteLink}</code>
              <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-foreground">Membros da equipe</h2>
          <p className="text-sm text-muted-foreground">
            Quem tem acesso ao dashboard. Remover acesso não apaga consultas nem dados do paciente.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{m.full_name || m.email || "—"}</p>
                  <p className="text-sm text-muted-foreground">{m.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{ROLE_LABEL[m.role] ?? m.role}</p>
                </div>
                {m.id !== currentUserId && m.role !== "admin" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemove(m.id)}
                    disabled={removingId === m.id}
                  >
                    {removingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Remover acesso
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-medium text-foreground">Convites pendentes</h2>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {invites.map((i) => (
                <li key={i.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-foreground">{i.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{ROLE_LABEL[i.role] ?? i.role} · expira {new Date(i.expires_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => cancelInvite(i.id)}>
                    Cancelar convite
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
