import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import { formatPhoneBr } from "@/lib/format-phone";
import { getPatientConsultationHistory } from "../actions";

export default async function PacientePerfilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, email, phone, birth_date, cpf, notes, photo_url, created_at")
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!patient) notFound();

  const historyRes = await getPatientConsultationHistory(id, 50);
  const history = historyRes.data ?? [];

  const { data: comandas } = await supabase
    .from("comandas")
    .select("id, total_amount, paid_amount, status, created_at")
    .eq("patient_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: payments } = await supabase
    .from("patient_payments")
    .select("id, amount, paid_at, payment_method")
    .eq("patient_id", id)
    .order("paid_at", { ascending: false })
    .limit(20);

  const { data: timeline } = await supabase
    .from("event_timeline")
    .select("id, event_code, created_at, appointment_id")
    .eq("patient_id", id)
    .order("created_at", { ascending: false })
    .limit(30);

  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = (comandas ?? [])
    .filter((c) => c.status !== "paga" && c.status !== "cancelada")
    .reduce((s, c) => s + Math.max(0, Number(c.total_amount) - Number(c.paid_amount)), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/pacientes">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{patient.full_name}</h1>
          <p className="text-sm text-muted-foreground">Perfil do paciente</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <h2 className="font-semibold">Informações gerais</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {patient.email && <p><span className="text-muted-foreground">E-mail:</span> {patient.email}</p>}
            {patient.phone && <p><span className="text-muted-foreground">Telefone:</span> {formatPhoneBr(patient.phone)}</p>}
            {patient.birth_date && (
              <p>
                <span className="text-muted-foreground">Nascimento:</span>{" "}
                {new Date(patient.birth_date).toLocaleDateString("pt-BR")}
              </p>
            )}
            {patient.cpf && <p><span className="text-muted-foreground">CPF:</span> {patient.cpf}</p>}
            {patient.notes && <p className="text-muted-foreground whitespace-pre-wrap">{patient.notes}</p>}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/agenda?novaConsulta=1&patientId=${patient.id}`}>Agendar consulta</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <h2 className="font-semibold">Pagamentos</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Total pago:</span>{" "}
              <strong className="text-green-700 dark:text-green-400">
                {totalPaid.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Pendente:</span>{" "}
              <strong className={totalDue > 0 ? "text-amber-700 dark:text-amber-400" : ""}>
                {totalDue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
            </p>
            <ul className="divide-y text-sm max-h-48 overflow-y-auto">
              {(payments ?? []).map((p) => (
                <li key={p.id} className="py-2 flex justify-between">
                  <span>{new Date(p.paid_at).toLocaleDateString("pt-BR")}</span>
                  <span>{Number(p.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <h2 className="font-semibold">Linha do tempo</h2>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
              {(timeline ?? []).map((ev) => (
                <li key={ev.id} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">
                    {new Date(ev.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  <span>{ev.event_code}</span>
                </li>
              ))}
              {(!timeline || timeline.length === 0) && (
                <p className="text-muted-foreground">Sem eventos registrados.</p>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Consultas e atendimentos</h2>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma consulta registrada.</p>
          ) : (
            <ul className="divide-y">
              {history.map((item) => (
                <li key={item.id} className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {new Date(item.scheduled_at).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.professional_name ?? "—"} · {item.appointment_type_name ?? "Consulta"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.status}</Badge>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/agenda/consulta/${item.id}`}>Abrir</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
