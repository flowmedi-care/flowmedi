import Link from "next/link";

export default function AcessoRemovidoPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <div className="text-center max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Acesso removido</h1>
        <p className="text-muted-foreground text-sm">
          Você não tem mais acesso a esta clínica. Os dados das consultas e dos pacientes foram mantidos.
        </p>
        <p className="text-muted-foreground text-sm">
          Se acredita que isso é um erro, entre em contato com o administrador da clínica.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-9 px-4 py-2"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
