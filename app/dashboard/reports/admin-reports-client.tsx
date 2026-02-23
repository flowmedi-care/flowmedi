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
  { id: "atendente", label: "Por Atendente", icon: <UserCheck className="h-4 w-4" /> },
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
  crescimento: number;
  chartData: { date: string; total: number; realizadas: number; canceladas: number; faltas: number }[];
};
type PorProfissionalRow = {
  doctorId: string;
  full_name: string;
  total: number;
  realizadas: number;
  canceladas: number;
  faltas: number;
  taxaComparecimento: number;
  tempoMedioMin: number | null;
};
type PorAtendenteRow = {
  userId: string;
  full_name: string;
  agendamentosCriados: number;
  cancelamentos: number;
};
type Financeiro = {
  receitaTotal: number;
  receitaPorProfissional: { doctorId: string; valor: number }[];
  ticketMedio: number;
  mensagem: string;
  consultasRealizadas: number;
};
type Operacional = {
  totalConsultas: number;
  realizadas: number;
  taxaCancelamento: number;
  taxaNoShow: number;
  crescimentoPacientes: number;
  picoHorario: string | null;
};

export function AdminReportsClient({
  activeTab,
  period,
  visaoGeral,
  porProfissional,
  porAtendente,
  financeiro,
  operacional,
}: {
  activeTab: ReportTab;
  period: Period;
  visaoGeral: VisaoGeral | null;
  porProfissional: PorProfissionalRow[];
  porAtendente: PorAtendenteRow[];
  financeiro: Financeiro | null;
  operacional: Operacional | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        {TABS.map((t) => (
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
          <Card>
            <CardHeader>
              <span className="font-semibold">Crescimento vs período anterior</span>
              <p className="text-sm text-muted-foreground">{visaoGeral.crescimento}%</p>
            </CardHeader>
          </Card>
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
                      <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="realizadas" name="Realizadas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="canceladas" name="Canceladas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="faltas" name="Faltas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "profissional" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <span className="font-semibold">Métricas por profissional</span>
              <p className="text-sm text-muted-foreground">Total, realizadas, canceladas, faltas, taxa de comparecimento e tempo médio de atendimento</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 font-medium">Profissional</th>
                      <th className="text-right py-3 font-medium">Total</th>
                      <th className="text-right py-3 font-medium">Realizadas</th>
                      <th className="text-right py-3 font-medium">Canceladas</th>
                      <th className="text-right py-3 font-medium">Faltas</th>
                      <th className="text-right py-3 font-medium">Comparecimento</th>
                      <th className="text-right py-3 font-medium">Tempo médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porProfissional.map((row) => (
                      <tr key={row.doctorId} className="border-b border-border/50">
                        <td className="py-3 font-medium">{row.full_name}</td>
                        <td className="text-right py-3">{row.total}</td>
                        <td className="text-right py-3 text-green-600">{row.realizadas}</td>
                        <td className="text-right py-3 text-red-600">{row.canceladas}</td>
                        <td className="text-right py-3 text-amber-600">{row.faltas}</td>
                        <td className="text-right py-3">{row.taxaComparecimento}%</td>
                        <td className="text-right py-3">{row.tempoMedioMin != null ? `${row.tempoMedioMin} min` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {porProfissional.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">Nenhum dado no período.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "atendente" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <span className="font-semibold">Produtividade por atendente</span>
              <p className="text-sm text-muted-foreground">Agendamentos criados e cancelamentos (quem criou o agendamento)</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 font-medium">Atendente</th>
                      <th className="text-right py-3 font-medium">Agendamentos criados</th>
                      <th className="text-right py-3 font-medium">Cancelamentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porAtendente.map((row) => (
                      <tr key={row.userId} className="border-b border-border/50">
                        <td className="py-3 font-medium">{row.full_name}</td>
                        <td className="text-right py-3">{row.agendamentosCriados}</td>
                        <td className="text-right py-3 text-red-600">{row.cancelamentos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {porAtendente.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">Nenhum dado no período.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "financeiro" && financeiro && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <span className="font-semibold">Financeiro</span>
              <p className="text-sm text-muted-foreground">{financeiro.mensagem}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Receita total</p>
                  <p className="text-2xl font-bold">R$ {financeiro.receitaTotal.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ticket médio</p>
                  <p className="text-2xl font-bold">R$ {financeiro.ticketMedio.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Consultas realizadas (período)</p>
                  <p className="text-2xl font-bold">{financeiro.consultasRealizadas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "operacional" && operacional && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>
      )}
    </div>
  );
}
