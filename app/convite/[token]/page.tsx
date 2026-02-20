import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ConviteAcceptClient } from "./convite-accept-client";

const ROLE_LABEL: Record<string, string> = {
  medico: "Médico",
  secretaria: "Secretária",
};

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inviteRows } = await supabase.rpc("get_invite_by_token", {
    p_token: token,
  });

  const invite = Array.isArray(inviteRows) && inviteRows.length > 0 ? inviteRows[0] : null;
  const clinicName = invite?.clinic_name ?? null;
  const role = invite?.role ?? null;
  const email = invite?.email ?? null;

  if (!clinicName || !role) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-foreground">Convite inválido ou expirado</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            O link pode ter sido usado ou passou do prazo. Peça um novo convite ao administrador da clínica.
          </p>
          <Link href="/" className="inline-block mt-6 text-primary hover:underline text-sm">
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, active")
      .eq("id", user.id)
      .single();

    if (profile?.active !== false) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
          <ConviteAcceptClient
            token={token}
            clinicName={clinicName}
            roleLabel={ROLE_LABEL[role] ?? role}
            inviteEmail={email}
          />
        </div>
      );
    }
  }

  const { data: hasAccountData } = await supabase.rpc("check_invite_email_has_account", {
    p_token: token,
  });
  const hasAccount = hasAccountData === true || (Array.isArray(hasAccountData) && hasAccountData[0] === true) || false;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <div className="text-center max-w-md space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Você foi convidado</h1>
        <p className="text-muted-foreground">
          <strong>{clinicName}</strong> convidou você para entrar como <strong>{ROLE_LABEL[role] ?? role}</strong>
          {email ? <> para o e-mail <strong>{email}</strong></> : null}.
        </p>
        {hasAccount ? (
          <>
            <p className="text-sm text-muted-foreground">
              Este e-mail já possui conta. Entre para aceitar o convite.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/entrar?redirect=/convite/${token}`}>
                <span className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-9 px-4 py-2 w-full sm:w-auto">
                  Entrar
                </span>
              </Link>
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
                Voltar ao início
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Crie uma conta com este e-mail para aceitar o convite automaticamente.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/criar-conta?redirect=/convite/${token}&email=${encodeURIComponent(email ?? "")}`}>
                <span className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-9 px-4 py-2 w-full sm:w-auto">
                  Criar conta
                </span>
              </Link>
              <Link href={`/entrar?redirect=/convite/${token}`}>
                <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background h-9 px-4 py-2 w-full sm:w-auto">
                  Já tenho conta
                </span>
              </Link>
            </div>
          </>
        )}
        {!hasAccount && (
          <Link href="/" className="block text-sm text-muted-foreground hover:text-foreground">
            Voltar ao início
          </Link>
        )}
      </div>
    </div>
  );
}
