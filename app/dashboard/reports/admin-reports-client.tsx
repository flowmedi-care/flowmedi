"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  LayoutDashboard,
  Stethoscope,
  UserCheck,
  DollarSign,
  Activity,
  TrendingUp,
  Calendar,
  Users,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportTab } from "../admin-dashboard";
import type { Period } from "./actions";

const TABS: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
  { id: "visao-geral", label: "Visão Geral", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "profissional", label: "Por Profissional", icon: <Stethoscope className="h-4 w-4" /> },
  { id: "atendente", label: "Produtividade da Equipe", icon: <UserCheck className="h-4 w-4" /> },
  { id: "financeiro", label: "Financeiro", icon: <DollarSign className="h-4 w-4" /> },
  { id: "operacional", label: "Operacional", icon: <Activity className="h-4 w-4" /> },
];

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
];

type VisaoGeral = {
  total: number;
  realizadas: number;
  canceladas: number;
  faltas: number;
  agendadaOuConfirmada: number;
  taxaComparecimento: number;
  taxaNoShow: number;
  crescimento: number;
  ticketMedioRealizadas: number;
  receitaPerdidaEstimada: number;
  pacientesRiscoNoShow: {
    patientId: string;
    full_name: string;
    phone: string | null;
    scheduled_at: string;
    riskScore: number;
    riskLabel: "alto" | "medio";
  }[];
  horariosOciosos: { hour: string; appointments: number; recommendation: string }[];
  resumoExecutivo: { titulo: string; impacto: string; acao: string; tone: "positive" | "warning" | "neutral" }[];
  funilGeral: {
    agendadas: number;
    confirmadas: number;
    compareceram: number;
    noShow: number;
    retornoAgendado: number;
    taxaConfirmacao: number;
    taxaComparecimento: number;
    taxaRetorno: number;
  };
  metas: {
    key: "confirmacao" | "comparecimento" | "noShow" | "ocupacao" | "retorno";
    label: string;
    current: number;
    target: number;
    status: "ok" | "warning" | "critical";
    trendVs30d: number;
  }[];
  alertas: { title: string; context: string; action: string; severity: "ok" | "warning" | "critical" }[];
  benchmark: {
    noShow7d: number;
    noShow30d: number;
    confirmacao7d: number;
    confirmacao30d: number;
    comparecimento7d: number;
    comparecimento30d: number;
    ocupacao7d: number;
    ocupacao30d: number;
  };
  briefingExecutivo: {
    vitorias: string[];
    riscos: string[];
    acoes: string[];
  };
  funilPorProfissional: {
    id: string;
    label: string;
    agendadas: number;
    confirmadas: number;
    compareceram: number;
    noShow: number;
    retornoAgendado: number;
    taxaConfirmacao: number;
    taxaComparecimento: number;
    taxaRetorno: number;
  }[];
  funilPorAtendente: {
    id: string;
    label: string;
    agendadas: number;
    confirmadas: number;
    compareceram: number;
    noShow: number;
    retornoAgendado: number;
    taxaConfirmacao: number;
    taxaComparecimento: number;
    taxaRetorno: number;
  }[];
  funilPorTipoConsulta: {
    id: string;
    label: string;
    agendadas: number;
    confirmadas: number;
    compareceram: number;
    noShow: number;
    retornoAgendado: number;
    taxaConfirmacao: number;
    taxaComparecimento: number;
    taxaRetorno: number;
  }[];
  funilPorOrigem: {
    id: string;
    label: string;
    agendadas: number;
    confirmadas: number;
    compareceram: number;
    noShow: number;
    retornoAgendado: number;
    taxaConfirmacao: number;
    taxaComparecimento: number;
    taxaRetorno: number;
  }[];
  chartData: { date: string; total: number; realizadas: number; canceladas: number; faltas: number }[];
};
type PorProfissional = {
  rows: {
    doctorId: string;
    full_name: string;
    total: number;
    realizadas: number;
    canceladas: number;
    faltas: number;
    taxaConfirmacao: number;
    taxaComparecimento: number;
    taxaNoShow: number;
    taxaRetorno: number;
    tempoMedioMin: number | null;
    status: "ok" | "warning" | "critical";
    acaoRecomendada: string;
  }[];
  topPerformance: {
    doctorId: string;
    full_name: string;
    taxaComparecimento: number;
  }[];
  pontosAtencao: {
    doctorId: string;
    full_name: string;
    taxaNoShow: number;
    acaoRecomendada: string;
  }[];
  metas: {
    comparecimento: number;
    noShow: number;
    retorno: number;
  };
};
type PorAtendente = {
  rows: {
    userId: string;
    full_name: string;
    agendamentosCriados: number;
    cancelamentos: number;
    confirmadas: number;
    compareceram: number;
    faltas: number;
    taxaConfirmacao: number;
    taxaComparecimento: number;
    taxaNoShow: number;
    status: "ok" | "warning" | "critical";
    acaoRecomendada: string;
  }[];
  ranking: {
    userId: string;
    full_name: string;
    taxaComparecimento: number;
  }[];
  alertas: {
    userId: string;
    full_name: string;
    taxaNoShow: number;
    acaoRecomendada: string;
  }[];
  metas: {
    confirmacao: number;
    noShow: number;
  };
};
type Financeiro = {
  receitaTotal: number;
  receitaPerdidaTotal: number;
  receitaPerdidaFaltas: number;
  receitaPerdidaCancelamentos: number;
  receitaPorProfissional: { doctorId: string; doctorName: string; valor: number }[];
  receitaPorServico: { servico: string; valor: number }[];
  ticketMedio: number;
  ltvAproximado: number;
  previsaoReceita7d: number;
  previsaoReceita30d: number;
  mensagensResumo: {
    totalMensagens: number;
    mensagensWhatsApp: number;
    mensagensEmail: number;
    whatsappPost24hStartsMesAtual: number;
  };
  conversaoPorTemplate: {
    type: string;
    enviados: number;
    vinculadosConsulta: number;
    taxaConfirmacao: number;
    taxaComparecimento: number;
    noShow: number;
    impactoReceitaEstimada: number;
    roiIndice: number;
  }[];
  mensagem: string;
  consultasRealizadas: number;
};
type Operacional = {
  totalConsultas: number;
  realizadas: number;
  taxaCancelamento: number;
  taxaNoShow: number;
  taxaOcupacao: number;
  crescimentoPacientes: number;
  picoHorario: string | null;
  metas: {
    ocupacao: number;
    noShow: number;
    cancelamento: number;
  };
  gargalos: { titulo: string; impacto: string; acao: string; status: "ok" | "warning" | "critical" }[];
  distribuicaoPorHora: { hour: string; total: number; status: "ok" | "warning" | "critical" }[];
  distribuicaoPorDiaSemana: { day: string; total: number }[];
};

export function AdminReportsClient({
  activeTab,
  allowedTabs,
  period,
  visaoGeral,
  porProfissional,
  porAtendente,
  financeiro,
  operacional,
}: {
  activeTab: ReportTab;
  allowedTabs: ReportTab[];
  period: Period;
  visaoGeral: VisaoGeral | null;
  porProfissional: PorProfissional | null;
  porAtendente: PorAtendente | null;
  financeiro: Financeiro | null;
  operacional: Operacional | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
  const sectionTitleClass = "text-base font-semibold";
  const sectionDescClass = "text-sm text-muted-foreground";
  const tableClass = "w-full text-sm";
  const thClass = "py-2.5 font-medium";
  const tdClass = "py-2.5";
  const statusClass = (s: "ok" | "warning" | "critical") =>
    s === "ok"
      ? "bg-green-100 text-green-700"
      : s === "warning"
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  function setTab(tab: ReportTab) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    router.push(`/dashboard?${p.toString()}`);
  }

  function setPeriod(period: Period) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("period", period);
    router.push(`/dashboard?${p.toString()}`);
  }

  return (
    <div className="space-y-6">
      {allowedTabs.length === 0 && (
        <Card>
          <CardHeader>
            <span className="font-semibold">Relatórios indisponíveis no plano atual</span>
            <p className="text-sm text-muted-foreground">
              Faça upgrade do plano para liberar os módulos de relatório.
            </p>
          </CardHeader>
        </Card>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        {TABS.filter((t) => allowedTabs.includes(t.id)).map((t) => (
          <Button
            key={t.id}
            variant={activeTab === t.id ? "secondary" : "ghost"}
            size="sm"
            className={cn("gap-2", activeTab === t.id && "bg-primary/10 text-primary")}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            {t.label}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Período:</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeTab === "visao-geral" && visaoGeral && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">Total de consultas</span>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{visaoGeral.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">Realizadas</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{visaoGeral.realizadas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">Canceladas / Faltas</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {visaoGeral.canceladas} / {visaoGeral.faltas}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">Taxa comparecimento</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{visaoGeral.taxaComparecimento}%</div>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <span className="text-sm font-medium text-muted-foreground">Perda estimada (faltas/cancelamentos)</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(visaoGeral.receitaPerdidaEstimada)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <span className="text-sm font-medium text-muted-foreground">Ticket médio (realizadas)</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(visaoGeral.ticketMedioRealizadas)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <span className="text-sm font-medium text-muted-foreground">Taxa de no-show</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{visaoGeral.taxaNoShow}%</div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <span className="font-semibold">Variação do período</span>
              <p className="text-sm text-muted-foreground">{visaoGeral.crescimento}%</p>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="space-y-1">
              <span className={sectionTitleClass}>Briefing executivo automático</span>
              <p className={sectionDescClass}>3 vitórias, 3 riscos e 3 ações recomendadas.</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-semibold text-green-700">Vitórias</p>
                  <div className="mt-2 space-y-2 text-sm">
                    {visaoGeral.briefingExecutivo.vitorias.map((item, idx) => (
                      <p key={`vitoria-${idx}`}>- {item}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-semibold text-amber-700">Riscos</p>
                  <div className="mt-2 space-y-2 text-sm">
                    {visaoGeral.briefingExecutivo.riscos.map((item, idx) => (
                      <p key={`risco-${idx}`}>- {item}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-semibold text-primary">Ações para hoje</p>
                  <div className="mt-2 space-y-2 text-sm">
                    {visaoGeral.briefingExecutivo.acoes.map((item, idx) => (
                      <p key={`acao-${idx}`}>- {item}</p>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="space-y-1">
                <span className={sectionTitleClass}>Top pacientes com risco de no-show</span>
                <p className={sectionDescClass}>
                  Priorize contato hoje para reduzir faltas da próxima semana.
                </p>
              </CardHeader>
              <CardContent>
                {visaoGeral.pacientesRiscoNoShow.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem pacientes críticos para os próximos 7 dias.</p>
                ) : (
                  <div className="space-y-2">
                    {visaoGeral.pacientesRiscoNoShow.slice(0, 10).map((p) => (
                      <div key={`${p.patientId}-${p.scheduled_at}`} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                        <div>
                          <p className="font-medium">{p.full_name}</p>
                          <p className="text-muted-foreground">
                            {new Date(p.scheduled_at).toLocaleString("pt-BR")} {p.phone ? `· ${p.phone}` : ""}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded px-2 py-1 text-xs font-medium",
                            p.riskLabel === "alto" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                          )}
                        >
                          Risco {p.riskLabel} ({p.riskScore})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="space-y-1">
                <span className={sectionTitleClass}>Horários com maior ociosidade</span>
                <p className={sectionDescClass}>
                  Sugestões de encaixe para aumentar ocupação.
                </p>
              </CardHeader>
              <CardContent>
                {visaoGeral.horariosOciosos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados suficientes no período.</p>
                ) : (
                  <div className="space-y-2">
                    {visaoGeral.horariosOciosos.map((slot) => (
                      <div key={slot.hour} className="rounded-md border border-border p-3">
                        <p className="font-medium">
                          {slot.hour} - {slot.appointments} agendamentos
                        </p>
                        <p className="text-sm text-muted-foreground">{slot.recommendation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          {visaoGeral.chartData.length > 0 && (
            <Card>
              <CardHeader>
                <span className="font-semibold">Consultas por dia</span>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visaoGeral.chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total" name="Total" fill="#14532d" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="realizadas" name="Realizadas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="canceladas" name="Canceladas" fill="#86efac" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="faltas" name="Faltas" fill="#bbf7d0" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "profissional" && porProfissional && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="space-y-1">
              <span className={sectionTitleClass}>Performance por profissional</span>
              <p className={sectionDescClass}>
                Objetivo: identificar quem precisa ação imediata e quem está puxando resultado.
              </p>
            </CardHeader>
          </Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <span className="text-sm font-medium text-muted-foreground">Meta comparecimento</span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{porProfissional.metas.comparecimento}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <span className="text-sm font-medium text-muted-foreground">Meta no-show</span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{porProfissional.metas.noShow}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <span className="text-sm font-medium text-muted-foreground">Meta retorno</span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{porProfissional.metas.retorno}%</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="space-y-1">
              <span className={sectionTitleClass}>Painel operacional por médico</span>
              <p className={sectionDescClass}>Funil, no-show, retorno e status por profissional</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead>
                    <tr className="border-b border-border">
                      <th className={`text-left ${thClass}`}>Profissional</th>
                      <th className={`text-right ${thClass}`}>Total</th>
                      <th className={`text-right ${thClass}`}>Conf.</th>
                      <th className={`text-right ${thClass}`}>Comparecimento</th>
                      <th className={`text-right ${thClass}`}>No-show</th>
                      <th className={`text-right ${thClass}`}>Retorno</th>
                      <th className={`text-right ${thClass}`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porProfissional.rows.map((row) => (
                      <tr key={row.doctorId} className="border-b border-border/50">
                        <td className={`${tdClass} font-medium`}>{row.full_name}</td>
                        <td className={`text-right ${tdClass}`}>{row.total}</td>
                        <td className={`text-right ${tdClass}`}>{row.taxaConfirmacao}%</td>
                        <td className={`text-right ${tdClass}`}>{row.taxaComparecimento}%</td>
                        <td className={`text-right ${tdClass}`}>{row.taxaNoShow}%</td>
                        <td className={`text-right ${tdClass}`}>{row.taxaRetorno}%</td>
                        <td className={`text-right ${tdClass}`}>
                          <span className={cn("rounded px-2 py-1 text-xs font-medium", statusClass(row.status))}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {porProfissional.rows.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">Nenhum dado no período.</p>
                )}
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <span className="font-semibold">Destaques de performance</span>
              </CardHeader>
              <CardContent className="space-y-2">
                {porProfissional.topPerformance.map((row) => (
                  <div key={row.doctorId} className="rounded-md border border-border p-2 text-sm flex items-center justify-between">
                    <span>{row.full_name}</span>
                    <span className="text-muted-foreground">{row.taxaComparecimento}% comparecimento</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <span className="font-semibold">Riscos por profissional</span>
              </CardHeader>
              <CardContent className="space-y-2">
                {porProfissional.pontosAtencao.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem alertas críticos por profissional.</p>
                ) : (
                  porProfissional.pontosAtencao.map((row) => (
                    <div key={row.doctorId} className="rounded-md border border-border p-2 text-sm">
                      <p className="font-medium">{row.full_name} · no-show {row.taxaNoShow}%</p>
                      <p className="text-muted-foreground">{row.acaoRecomendada}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "atendente" && porAtendente && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="space-y-1">
              <span className={sectionTitleClass}>Performance da equipe de atendimento</span>
              <p className={sectionDescClass}>
                Objetivo: melhorar confirmação e reduzir faltas por rotina operacional.
              </p>
            </CardHeader>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <span className="text-sm font-medium text-muted-foreground">Meta confirmação</span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{porAtendente.metas.confirmacao}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <span className="text-sm font-medium text-muted-foreground">Meta no-show</span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{porAtendente.metas.noShow}%</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="space-y-1">
              <span className={sectionTitleClass}>Painel operacional por atendente</span>
              <p className={sectionDescClass}>Funil com status e ação recomendada por pessoa</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead>
                    <tr className="border-b border-border">
                      <th className={`text-left ${thClass}`}>Atendente</th>
                      <th className={`text-right ${thClass}`}>Criados</th>
                      <th className={`text-right ${thClass}`}>Conf.</th>
                      <th className={`text-right ${thClass}`}>Comparecimento</th>
                      <th className={`text-right ${thClass}`}>No-show</th>
                      <th className={`text-right ${thClass}`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porAtendente.rows.map((row) => (
                      <tr key={row.userId} className="border-b border-border/50">
                        <td className={`${tdClass} font-medium`}>{row.full_name}</td>
                        <td className={`text-right ${tdClass}`}>{row.agendamentosCriados}</td>
                        <td className={`text-right ${tdClass}`}>{row.taxaConfirmacao}%</td>
                        <td className={`text-right ${tdClass}`}>{row.taxaComparecimento}%</td>
                        <td className={`text-right ${tdClass}`}>{row.taxaNoShow}%</td>
                        <td className={`text-right ${tdClass}`}>
                          <span className={cn("rounded px-2 py-1 text-xs font-medium", statusClass(row.status))}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {porAtendente.rows.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">Nenhum dado no período.</p>
                )}
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <span className="font-semibold">Ranking da equipe</span>
              </CardHeader>
              <CardContent className="space-y-2">
                {porAtendente.ranking.slice(0, 5).map((row) => (
                  <div key={row.userId} className="rounded-md border border-border p-2 text-sm flex items-center justify-between">
                    <span>{row.full_name}</span>
                    <span className="text-muted-foreground">{row.taxaComparecimento}% comparecimento</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <span className="font-semibold">Riscos da equipe e ação hoje</span>
              </CardHeader>
              <CardContent className="space-y-2">
                {porAtendente.alertas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem alertas críticos da equipe no período.</p>
                ) : (
                  porAtendente.alertas.map((row) => (
                    <div key={row.userId} className="rounded-md border border-border p-2 text-sm">
                      <p className="font-medium">{row.full_name} · no-show {row.taxaNoShow}%</p>
                      <p className="text-muted-foreground">{row.acaoRecomendada}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "financeiro" && financeiro && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="space-y-1">
              <span className={sectionTitleClass}>Performance financeira</span>
              <p className={sectionDescClass}>{financeiro.mensagem}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Receita total</p>
                  <p className="text-2xl font-bold">{formatCurrency(financeiro.receitaTotal)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ticket médio</p>
                  <p className="text-2xl font-bold">{formatCurrency(financeiro.ticketMedio)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Consultas realizadas (período)</p>
                  <p className="text-2xl font-bold">{financeiro.consultasRealizadas}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">LTV aproximado (12m)</p>
                  <p className="text-2xl font-bold">{formatCurrency(financeiro.ltvAproximado)}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm text-muted-foreground">Perda estimada total</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(financeiro.receitaPerdidaTotal)}</p>
                  <p className="text-xs text-muted-foreground">
                    Faltas: {formatCurrency(financeiro.receitaPerdidaFaltas)} · Cancelamentos: {formatCurrency(financeiro.receitaPerdidaCancelamentos)}
                  </p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm text-muted-foreground">Previsão de faturamento (7 dias)</p>
                  <p className="text-xl font-bold">{formatCurrency(financeiro.previsaoReceita7d)}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm text-muted-foreground">Previsão de faturamento (30 dias)</p>
                  <p className="text-xl font-bold">{formatCurrency(financeiro.previsaoReceita30d)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <span className="font-semibold">Receita por profissional</span>
              </CardHeader>
              <CardContent>
                {financeiro.receitaPorProfissional.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sem dados de receita por profissional no período.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 font-medium">Profissional</th>
                          <th className="text-right py-3 font-medium">Receita</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financeiro.receitaPorProfissional.map((row) => (
                          <tr key={row.doctorId} className="border-b border-border/50">
                            <td className="py-3 font-medium">{row.doctorName}</td>
                            <td className="text-right py-3">{formatCurrency(row.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <span className="font-semibold">Receita por serviço/tipo</span>
              </CardHeader>
              <CardContent>
                {financeiro.receitaPorServico.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sem dados de receita por serviço no período.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 font-medium">Serviço / Tipo</th>
                          <th className="text-right py-3 font-medium">Receita</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financeiro.receitaPorServico.map((row) => (
                          <tr key={row.servico} className="border-b border-border/50">
                            <td className="py-3 font-medium">{row.servico}</td>
                            <td className="text-right py-3">{formatCurrency(row.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <span className="font-semibold">Comunicação: volume e ROI por template/evento</span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm text-muted-foreground">Mensagens totais</p>
                  <p className="text-xl font-bold">{financeiro.mensagensResumo.totalMensagens}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm text-muted-foreground">WhatsApp / E-mail</p>
                  <p className="text-xl font-bold">
                    {financeiro.mensagensResumo.mensagensWhatsApp} / {financeiro.mensagensResumo.mensagensEmail}
                  </p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm text-muted-foreground">Inícios pós-24h (mês)</p>
                  <p className="text-xl font-bold">{financeiro.mensagensResumo.whatsappPost24hStartsMesAtual}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm text-muted-foreground">Receita prevista 30d</p>
                  <p className="text-xl font-bold">{formatCurrency(financeiro.previsaoReceita30d)}</p>
                </div>
              </div>
              {financeiro.conversaoPorTemplate.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados de conversão por template/evento no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 font-medium">Template / Evento</th>
                        <th className="text-right py-3 font-medium">Enviados</th>
                        <th className="text-right py-3 font-medium">Confirmação</th>
                        <th className="text-right py-3 font-medium">Comparecimento</th>
                        <th className="text-right py-3 font-medium">Impacto receita</th>
                        <th className="text-right py-3 font-medium">ROI índice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeiro.conversaoPorTemplate.map((row) => (
                        <tr key={row.type} className="border-b border-border/50">
                          <td className="py-3 font-medium">{row.type}</td>
                          <td className="text-right py-3">{row.enviados}</td>
                          <td className="text-right py-3">{row.taxaConfirmacao}%</td>
                          <td className="text-right py-3">{row.taxaComparecimento}%</td>
                          <td className="text-right py-3">{formatCurrency(row.impactoReceitaEstimada)}</td>
                          <td className="text-right py-3">{row.roiIndice.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "operacional" && operacional && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="space-y-1">
              <span className={sectionTitleClass}>Eficiência operacional</span>
              <p className={sectionDescClass}>
                Objetivo: reduzir ociosidade, no-show e cancelamentos com ações diárias.
              </p>
            </CardHeader>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">Total consultas</span>
                <Calendar className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{operacional.totalConsultas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">Taxa cancelamento</span>
                <AlertCircle className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{operacional.taxaCancelamento}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">Taxa no-show</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{operacional.taxaNoShow}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">Taxa ocupação</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{operacional.taxaOcupacao}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-sm font-medium text-muted-foreground">Novos pacientes</span>
                <Users className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{operacional.crescimentoPacientes}</div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <span className="font-semibold">Pico de atendimento</span>
              <p className="text-sm text-muted-foreground">
                Horário com mais consultas no período: {operacional.picoHorario ?? "—"}
              </p>
            </CardHeader>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <span className="font-semibold">Gargalos operacionais</span>
              </CardHeader>
              <CardContent className="space-y-2">
                {operacional.gargalos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem gargalos críticos no período.</p>
                ) : (
                  operacional.gargalos.map((g, idx) => (
                    <div key={`${g.titulo}-${idx}`} className="rounded-md border border-border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{g.titulo}</p>
                        <span className={cn("rounded px-2 py-1 text-xs font-medium", statusClass(g.status))}>
                          {g.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{g.impacto}</p>
                      <p className="text-sm">{g.acao}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <span className="font-semibold">Distribuição por hora</span>
              </CardHeader>
              <CardContent className="space-y-2">
                {operacional.distribuicaoPorHora.map((h) => (
                  <div key={h.hour} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <span>{h.hour}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{h.total} consultas</span>
                      <span className={cn("rounded px-2 py-0.5 text-xs font-medium", statusClass(h.status))}>
                        {h.status}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <span className="font-semibold">Distribuição por dia da semana</span>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {operacional.distribuicaoPorDiaSemana.map((d) => (
                  <div key={d.day} className="rounded-md border border-border p-2 text-sm flex items-center justify-between">
                    <span>{d.day}</span>
                    <span className="font-medium">{d.total}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
