import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, ClipboardList, FileText, Pill, FlaskConical } from "lucide-react";

const links = [
  {
    href: "/dashboard/atendimento",
    label: "Lista operacional",
    desc: "Atendimentos recentes, comandas e cobrança",
    icon: ClipboardList,
  },
  {
    href: "/dashboard/consulta",
    label: "Lista de consultas",
    desc: "Todas as consultas agendadas (Agenda → Lista de consultas)",
    icon: CalendarDays,
  },
  {
    href: "/dashboard/atendimentos/prescricoes",
    label: "Prescrições",
    desc: "Receitas emitidas em atendimentos",
    icon: Pill,
  },
  {
    href: "/dashboard/atendimentos/pedidos-exame",
    label: "Pedidos de exame",
    desc: "Solicitações de exames",
    icon: FlaskConical,
  },
  {
    href: "/dashboard/atendimentos/atestados",
    label: "Atestados",
    desc: "Atestados registrados nas fichas",
    icon: FileText,
  },
  {
    href: "/dashboard/atendimentos/sadt",
    label: "Guia SP / SADT",
    desc: "Convênios e TISS",
    icon: FileText,
  },
];

export default function AtendimentosHubPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Documentos clínicos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Central de documentos emitidos nos atendimentos. Para agendar ou ver consultas, use{" "}
          <strong>Agenda</strong> no menu; para a fila operacional do dia, use{" "}
          <strong>Atendimento</strong>.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((item) => (
          <Card key={item.href}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <item.icon className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">{item.label}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </CardHeader>
            <CardContent>
              <Link href={item.href}>
                <Button variant="outline" size="sm">
                  Abrir
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
