import Link from "next/link";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { Button } from "@/components/ui/button";

export default function FinanceiroLessonPage() {
  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "Instruções", href: "/dashboard/instrucoes" },
          { label: "Financeiro" },
        ],
        title: "Financeiro e cobrança",
        description: "Do atendimento à comanda paga — o aha completo da clínica.",
      }}
    >
      <div className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed">
        <p>
          Depois da consulta marcada, o ciclo fecha assim: atendimento concluído → emitir comanda →
          registrar pagamento → ver no extrato. Esse é o <em>aha completo</em>: “minha clínica
          funciona”.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>Na consulta, conclua o atendimento (no tour, um clique).
          </li>
          <li>Emita a comanda com o valor do serviço.</li>
          <li>Registre o pagamento (PIX, cartão, etc.).</li>
          <li>Abra o Financeiro e veja a entrada.</li>
        </ol>
        <p className="text-muted-foreground">
          Na demonstração tudo é reversível — você pode apagar os dados demo em Configurações.
        </p>
        <Button asChild>
          <Link href="/dashboard/onboarding/tour">Fazer o tour completo</Link>
        </Button>
      </div>
    </PageShell>
  );
}
