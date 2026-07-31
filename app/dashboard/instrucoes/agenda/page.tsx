import Link from "next/link";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { Button } from "@/components/ui/button";
import { MARIA_STORY } from "@/lib/onboarding/copy";

export default function AgendaLessonPage() {
  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "Instruções", href: "/dashboard/instrucoes" },
          { label: "Agenda" },
        ],
        title: "Agenda e consultas",
        description: "Como um contato vira horário na agenda — o mini-aha da ativação.",
      }}
    >
      <div className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed">
        <p>
          Na ativação, <strong>{MARIA_STORY.name}</strong> pede uma avaliação e você confirma a
          consulta pré-preenchida. Em menos de dois minutos a agenda já tem um atendimento — isso é
          o <em>mini-aha</em>: “minha agenda funciona”.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>Abra a pendência da Maria no Workspace.</li>
          <li>Clique em Agendar — paciente, serviço e horário já vêm prontos.</li>
          <li>Confirme. A consulta aparece na agenda.</li>
        </ol>
        <p className="text-muted-foreground">
          No dia a dia real o fluxo é o mesmo: lead ou paciente → escolher horário → confirmar. A
          diferença é que os dados serão os da sua clínica.
        </p>
        <Button asChild>
          <Link href="/dashboard/onboarding/tour">Ver com a Maria</Link>
        </Button>
      </div>
    </PageShell>
  );
}
