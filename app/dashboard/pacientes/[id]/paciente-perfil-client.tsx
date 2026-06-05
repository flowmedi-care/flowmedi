"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPhoneBr } from "@/lib/format-phone";
import { toast } from "@/components/ui/toast";
import { ExamesClient } from "../../exames/exames-client";
import { ProntuarioFichasSection } from "./prontuario-fichas-section";
import { uploadPatientPhoto } from "../profile-actions";
import { getComandaDetail, type ComandaDetail } from "../../agenda/encounter-actions";
import { CancelComandaDialog } from "../../financeiro/components/cancel-comanda-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { calcPatientAge, type PatientProfileBundle } from "../profile-types";
import {
  ChevronLeft,
  User,
  Mail,
  Phone,
  Cake,
  FileText,
  Calendar,
  CreditCard,
  ClipboardList,
  Pill,
  Clock,
  Camera,
  Pencil,
  CalendarPlus,
  MessageCircle,
  MapPin,
  Stethoscope,
} from "lucide-react";

type TabId =
  | "informacoes"
  | "timeline"
  | "prontuario"
  | "pagamentos"
  | "formularios"
  | "receitas";

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "informacoes", label: "Informações", icon: User },
  { id: "timeline", label: "Linha do tempo", icon: Clock },
  { id: "prontuario", label: "Prontuário", icon: Stethoscope },
  { id: "pagamentos", label: "Pagamentos", icon: CreditCard },
  { id: "formularios", label: "Formulários", icon: ClipboardList },
  { id: "receitas", label: "Receitas e meds.", icon: Pill },
];

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  falta: "Falta",
  cancelada: "Cancelada",
};

const COMANDA_STATUS: Record<string, string> = {
  aberta: "Aberta",
  parcial: "Parcial",
  paga: "Paga",
  cancelada: "Cancelada",
};

const FORM_STATUS: Record<string, string> = {
  pendente: "Pendente",
  preenchido: "Preenchido",
  enviado: "Enviado",
};

function whatsAppUrl(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

function formatCpf(cpf: string | null): string {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function InfoRow({
  icon: Icon,
  label,
  value,
  action,
}: {
  icon: typeof User;
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-3 border-b border-border last:border-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-base break-words">{value}</div>
        {action}
      </div>
    </div>
  );
}

export function PacientePerfilClient({
  bundle,
  canEdit,
  canCancelComanda = false,
  userRole,
}: {
  bundle: PatientProfileBundle;
  canEdit: boolean;
  canCancelComanda?: boolean;
  userRole?: string;
}) {
  const router = useRouter();
  const { patient, customFields, timeline, consultations, payments, comandas, forms, clinicalDocuments, recommendations, financial } =
    bundle;
  const [activeTab, setActiveTab] = useState<TabId>("informacoes");
  const [photoUrl, setPhotoUrl] = useState(patient.photo_url);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [comandaDetail, setComandaDetail] = useState<ComandaDetail | null>(null);
  const [comandaDetailOpen, setComandaDetailOpen] = useState(false);
  const [loadingComanda, setLoadingComanda] = useState(false);
  const [cancelComanda, setCancelComanda] = useState<{
    id: string;
    total_amount: number;
    paid_amount: number;
    status: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const age = calcPatientAge(patient.birth_date);
  const wa = whatsAppUrl(patient.phone);

  async function openComandaDetail(comandaId: string) {
    setLoadingComanda(true);
    setComandaDetailOpen(true);
    const res = await getComandaDetail(comandaId);
    setLoadingComanda(false);
    if (res.error || !res.data) {
      toast(res.error ?? "Erro ao carregar comanda.", "error");
      setComandaDetailOpen(false);
      return;
    }
    setComandaDetail(res.data);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadPatientPhoto(patient.id, fd);
    setUploadingPhoto(false);
    if (res.error) {
      toast(res.error, "error");
    } else if (res.photoUrl) {
      setPhotoUrl(res.photoUrl);
      toast("Foto atualizada.", "success");
      router.refresh();
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <nav className="text-sm text-muted-foreground flex flex-wrap items-center gap-1">
        <Link href="/dashboard/contatos/pacientes" className="hover:text-foreground">
          Pacientes
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-none">
          {patient.full_name}
        </span>
      </nav>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/contatos/pacientes">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold sm:text-2xl">Perfil do paciente</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Coluna esquerda — resumo */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="h-28 w-28 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center border-2 border-border">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-14 w-14 text-primary/60" />
                )}
              </div>
              {canEdit && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
                    title="Alterar foto"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>

            <h2 className="text-lg font-semibold">{patient.full_name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {age != null && patient.birth_date
                ? `${age} anos`
                : patient.birth_date
                  ? new Date(patient.birth_date).toLocaleDateString("pt-BR")
                  : "Idade não informada"}
            </p>
            {patient.phone && (
              <p className="text-sm text-muted-foreground mt-0.5">{formatPhoneBr(patient.phone)}</p>
            )}
            {patient.cpf && (
              <p className="text-xs text-muted-foreground mt-0.5">{formatCpf(patient.cpf)}</p>
            )}
            <Badge className="mt-3" variant="secondary">
              Paciente
            </Badge>

            <div className="flex flex-col gap-2 w-full mt-6">
              {wa && (
                <Button className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white" asChild>
                  <a href={wa} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Enviar mensagem
                  </a>
                </Button>
              )}
              <Button variant="default" className="w-full" asChild>
                <Link href={`/dashboard/agenda?novaConsulta=1&patientId=${patient.id}`}>
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Agendar consulta
                </Link>
              </Button>
              {canEdit && (
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/dashboard/contatos/pacientes?edit=${patient.id}`}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar cadastro
                  </Link>
                </Button>
              )}
            </div>

            <div className="w-full mt-6 pt-4 border-t grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">
                  {financial.totalPaid.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
                <p className="text-muted-foreground mt-0.5">Pago</p>
              </div>
              <div>
                <p
                  className={cn(
                    "font-semibold",
                    financial.totalDue > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
                  )}
                >
                  {financial.totalDue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
                <p className="text-muted-foreground mt-0.5">Pendente</p>
              </div>
              <div>
                <p className="font-semibold">{consultations.length}</p>
                <p className="text-muted-foreground mt-0.5">Consultas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coluna direita — abas */}
        <div className="space-y-4 min-w-0">
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>

          <Card>
            <CardContent className="pt-6">
              {activeTab === "informacoes" && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Informações gerais</h3>
                  <InfoRow icon={User} label="Nome completo" value={patient.full_name} />
                  <InfoRow
                    icon={Cake}
                    label="Data de nascimento"
                    value={
                      patient.birth_date
                        ? `${new Date(patient.birth_date).toLocaleDateString("pt-BR")}${age != null ? ` (${age} anos)` : ""}`
                        : "—"
                    }
                  />
                  <InfoRow icon={Mail} label="E-mail" value={patient.email || "—"} />
                  <InfoRow
                    icon={Phone}
                    label="Telefone"
                    value={patient.phone ? formatPhoneBr(patient.phone) : "—"}
                    action={
                      wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-[#25D366] mt-1 hover:underline"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      ) : undefined
                    }
                  />
                  <InfoRow icon={FileText} label="CPF" value={formatCpf(patient.cpf)} />
                  {patient.notes && (
                    <InfoRow icon={MapPin} label="Observações" value={<span className="whitespace-pre-wrap">{patient.notes}</span>} />
                  )}
                  {customFields.map((field) => {
                    const value = patient.custom_fields[field.field_name];
                    if (value == null || value === "") return null;
                    return (
                      <InfoRow
                        key={field.id}
                        icon={FileText}
                        label={field.field_label}
                        value={String(value)}
                      />
                    );
                  })}
                  <p className="text-xs text-muted-foreground mt-4">
                    Cadastrado em {new Date(patient.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              )}

              {activeTab === "timeline" && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Linha do tempo</h3>
                  {timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
                  ) : (
                    <ul className="relative border-l border-border ml-3 space-y-6 pl-6">
                      {timeline.slice(0, 40).map((item) => (
                        <li key={item.id} className="relative">
                          <span className="absolute -left-[1.65rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.date).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {item.href ? (
                            <Link href={item.href} className="font-medium text-sm hover:underline text-primary">
                              {item.title}
                            </Link>
                          ) : (
                            <p className="font-medium text-sm">{item.title}</p>
                          )}
                          {item.subtitle && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activeTab === "prontuario" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Consultas e evolução</h3>
                    {consultations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma consulta no prontuário.</p>
                    ) : (
                      <ul className="divide-y">
                        {consultations.map((c) => (
                          <li key={c.id} className="py-3 flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm">
                                {new Date(c.scheduled_at).toLocaleString("pt-BR")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {[c.professional_name, c.appointment_type_name, ...c.procedure_names]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              {c.notes && (
                                <p className="text-sm mt-2 text-muted-foreground whitespace-pre-wrap border-l-2 pl-3 border-primary/30">
                                  {c.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline">{STATUS_LABEL[c.status] ?? c.status}</Badge>
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/dashboard/agenda/consulta/${c.id}`}>Abrir</Link>
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="pt-4 border-t">
                    <h3 className="text-lg font-semibold mb-3">Fichas de atendimento</h3>
                    <ProntuarioFichasSection patientId={patient.id} />
                  </div>
                  <div className="pt-4 border-t">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Arquivos e exames
                    </h3>
                    <ExamesClient patientId={patient.id} canEdit={canEdit} />
                  </div>
                </div>
              )}

              {activeTab === "pagamentos" && (
                <div className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-4 bg-green-50/50 dark:bg-green-950/20">
                      <p className="text-xs text-muted-foreground">Total recebido</p>
                      <p className="text-xl font-semibold text-green-700 dark:text-green-400">
                        {financial.totalPaid.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4 bg-amber-50/50 dark:bg-amber-950/20">
                      <p className="text-xs text-muted-foreground">Em aberto / inadimplente</p>
                      <p className="text-xl font-semibold text-amber-700 dark:text-amber-400">
                        {financial.totalDue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-muted-foreground">Total faturado (comandas)</p>
                      <p className="text-xl font-semibold">
                        {financial.totalBilled.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Pagamentos registrados</h4>
                    {payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
                    ) : (
                      <ul className="divide-y text-sm">
                        {payments.map((p) => (
                          <li key={p.id} className="py-2 flex justify-between gap-2">
                            <span>
                              {new Date(p.paid_at).toLocaleDateString("pt-BR")}
                              {p.payment_method ? ` · ${p.payment_method}` : ""}
                            </span>
                            <span className="font-medium text-green-700 dark:text-green-400">
                              {p.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Comandas</h4>
                    {comandas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma comanda.</p>
                    ) : (
                      <ul className="divide-y text-sm">
                        {comandas.map((c) => {
                          const restante = Math.max(0, c.total_amount - c.paid_amount);
                          return (
                            <li key={c.id} className="py-2 flex flex-wrap justify-between gap-2 items-center">
                              <span>
                                {new Date(c.created_at).toLocaleDateString("pt-BR")} ·{" "}
                                {COMANDA_STATUS[c.status] ?? c.status}
                              </span>
                              <div className="flex items-center gap-2">
                                <span>
                                  {c.paid_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                  {" / "}
                                  {c.total_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                  {restante > 0 && c.status !== "paga" && c.status !== "cancelada" && (
                                    <span className="text-amber-600 dark:text-amber-400 ml-1">
                                      (falta {restante.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
                                    </span>
                                  )}
                                </span>
                                <Button variant="outline" size="sm" onClick={() => openComandaDetail(c.id)}>
                                  Ver itens
                                </Button>
                                {canCancelComanda &&
                                  (c.status === "aberta" || c.status === "parcial" || c.status === "paga") && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                      onClick={() =>
                                        setCancelComanda({
                                          id: c.id,
                                          total_amount: c.total_amount,
                                          paid_amount: c.paid_amount,
                                          status: c.status,
                                        })
                                      }
                                    >
                                      Cancelar comanda
                                    </Button>
                                  )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "formularios" && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Formulários</h3>
                  {forms.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum formulário vinculado.</p>
                  ) : (
                    <ul className="divide-y">
                      {forms.map((f) => (
                        <li key={f.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">{f.template_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(f.created_at).toLocaleDateString("pt-BR")}
                              {f.scheduled_at
                                ? ` · Consulta ${new Date(f.scheduled_at).toLocaleDateString("pt-BR")}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{FORM_STATUS[f.status] ?? f.status}</Badge>
                            {f.appointment_id && (
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/dashboard/agenda/atendimento/${f.appointment_id}`}>
                                  Ver
                                </Link>
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activeTab === "receitas" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Receitas e pedidos de exame</h3>
                    {clinicalDocuments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum documento clínico registrado.</p>
                    ) : (
                      <ul className="divide-y">
                        {clinicalDocuments.map((d) => (
                          <li key={d.id} className="py-3 flex flex-wrap justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">
                                {d.type === "prescription" ? "Receita" : "Pedido de exame"}
                                {d.title ? ` — ${d.title}` : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(d.created_at).toLocaleDateString("pt-BR")}
                                {d.doctor_name ? ` · ${d.doctor_name}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{d.status}</Badge>
                              {d.appointment_id && (
                                <Button variant="outline" size="sm" asChild>
                                  <Link
                                    href={`/dashboard/agenda/consulta/${d.appointment_id}?tab=${d.type === "prescription" ? "receitas" : "pedidos"}`}
                                  >
                                    Abrir consulta
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="pt-4 border-t">
                    <h3 className="text-lg font-semibold mb-3">Recomendações nas consultas</h3>
                    {recommendations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma recomendação registrada.</p>
                    ) : (
                      <ul className="space-y-4">
                        {recommendations.map((r) => (
                          <li key={r.appointment_id} className="rounded-lg border p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <p className="text-sm font-medium flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {new Date(r.scheduled_at).toLocaleDateString("pt-BR")}
                              </p>
                              {r.procedure_names.length > 0 && (
                                <p className="text-xs text-muted-foreground">{r.procedure_names.join(", ")}</p>
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{r.recommendations}</p>
                            <Button variant="link" size="sm" className="px-0 mt-2 h-auto" asChild>
                              <Link href={`/dashboard/agenda/consulta/${r.appointment_id}`}>Ver consulta</Link>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={comandaDetailOpen} onOpenChange={setComandaDetailOpen}>
        <DialogContent title="Detalhes da comanda" onClose={() => setComandaDetailOpen(false)} className="max-w-md">
          {loadingComanda ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : comandaDetail ? (
            <div className="space-y-4">
              <p className="text-sm">
                Status: <span className="font-medium">{COMANDA_STATUS[comandaDetail.status] ?? comandaDetail.status}</span>
              </p>
              <ul className="divide-y text-sm">
                {comandaDetail.items.map((item) => (
                  <li key={item.id} className="flex justify-between py-2">
                    <span>
                      {item.description} × {item.quantity}
                    </span>
                    <span>
                      {item.total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total</span>
                <span>
                  {comandaDetail.total_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
              {comandaDetail.payments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Pagamentos</p>
                  <ul className="text-sm space-y-1">
                    {comandaDetail.payments.map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span>{new Date(p.paid_at).toLocaleDateString("pt-BR")}</span>
                        <span>{p.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <CancelComandaDialog
        comanda={
          cancelComanda
            ? {
                id: cancelComanda.id,
                patient_name: patient.full_name,
                total_amount: cancelComanda.total_amount,
                paid_amount: cancelComanda.paid_amount,
                status: cancelComanda.status,
              }
            : null
        }
        userRole={userRole}
        onClose={() => setCancelComanda(null)}
      />
    </div>
  );
}
