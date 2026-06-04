import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Cake } from "lucide-react";
import { listBirthdaysToday } from "../actions";

export default async function AniversariantesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: birthdays, error } = await listBirthdaysToday();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Cake className="h-6 w-6 text-primary" />
          Aniversariantes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pacientes que fazem aniversário hoje.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <p className="text-sm font-medium">
            Hoje — {(birthdays ?? []).length} paciente(s)
          </p>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {(birthdays ?? []).map((p) => (
            <div key={p.id} className="py-3 first:pt-0">
              <Link
                href={`/dashboard/contatos/pacientes/${p.id}`}
                className="font-medium hover:text-primary"
              >
                {p.full_name}
              </Link>
              <p className="text-sm text-muted-foreground">
                {[p.phone, p.email].filter(Boolean).join(" · ")}
              </p>
            </div>
          ))}
          {(birthdays ?? []).length === 0 && !error && (
            <p className="text-sm text-muted-foreground py-4">
              Nenhum aniversariante hoje.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
