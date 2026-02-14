"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMessagePreviewForEvent } from "../actions";
import { Mail, MessageSquare, ArrowLeft } from "lucide-react";
import type { MessagePreviewItem } from "@/lib/message-processor";

export default function EventosTestePage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");
  const [preview, setPreview] = useState<MessagePreviewItem[]>([]);
  const [eventName, setEventName] = useState<string | undefined>();
  const [patientName, setPatientName] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!eventId);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getMessagePreviewForEvent(eventId).then((res) => {
      if (cancelled) return;
      setPreview(res.preview || []);
      setEventName(res.eventName);
      setPatientName(res.patientName);
      setError(res.error || null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [eventId]);

  if (!eventId) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/eventos">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Eventos
          </Button>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Preview de mensagem (teste)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Esta página mostra a mensagem que seria enviada quando um evento dispara email ou WhatsApp.
              Para fins de teste, o envio real está desativado (NEXT_PUBLIC_MESSAGE_TEST_MODE=true).
            </p>
            <p className="text-muted-foreground mt-2">
              Acesse a partir de um evento: clique em &quot;Enviar&quot; em um evento pendente e você será redirecionado aqui com o preview.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/eventos">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Eventos
          </Button>
        </Link>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Carregando preview...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Preview da mensagem que seria enviada</CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                {eventName && (
                  <Badge variant="secondary">Evento: {eventName}</Badge>
                )}
                {patientName && (
                  <Badge variant="outline">Paciente: {patientName}</Badge>
                )}
              </div>
            </CardHeader>
          </Card>

          {preview.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-muted-foreground">
                Nenhum canal configurado ou template não encontrado para este evento.
              </CardContent>
            </Card>
          ) : (
            preview.map((item) => (
              <Card key={item.channel}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {item.channel === "email" ? (
                      <Mail className="h-4 w-4" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                    {item.channel === "email" ? "Email" : "WhatsApp"}
                    {item.templateName && (
                      <span className="text-sm font-normal text-muted-foreground">
                        — {item.templateName}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.channel === "email" && item.subject && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Assunto</p>
                      <p className="rounded border bg-muted/50 p-2 text-sm">{item.subject}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Corpo da mensagem</p>
                    <div
                      className="rounded border bg-muted/50 p-3 text-sm whitespace-pre-wrap prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: item.body }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </>
      )}
    </div>
  );
}
