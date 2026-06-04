"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DocumentosListClient({
  title,
  subtitle,
  items,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  items: {
    id: string;
    created_at: string;
    patient_name: string;
    patient_id?: string;
    doctor_name?: string;
    preview?: string;
    appointment_id?: string;
  }[];
  emptyMessage: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <Card>
        <CardHeader>
          <p className="text-sm font-medium">{items.length} registro(s)</p>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.id} className="py-3 first:pt-0">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  {item.patient_id ? (
                    <Link
                      href={`/dashboard/contatos/pacientes/${item.patient_id}`}
                      className="font-medium hover:text-primary"
                    >
                      {item.patient_name}
                    </Link>
                  ) : (
                    <p className="font-medium">{item.patient_name}</p>
                  )}
                  {item.doctor_name && (
                    <p className="text-xs text-muted-foreground">Dr(a). {item.doctor_name}</p>
                  )}
                  {item.preview && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{item.preview}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground shrink-0">
                  {new Date(item.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              {item.appointment_id && (
                <Link
                  href={`/dashboard/agenda/atendimento/${item.appointment_id}`}
                  className="text-xs text-primary hover:underline mt-1 inline-block"
                >
                  Ver atendimento
                </Link>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">{emptyMessage}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
