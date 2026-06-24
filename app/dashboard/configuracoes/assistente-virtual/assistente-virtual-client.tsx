"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  DAY_LABELS,
  DEFAULT_OPERATING_HOURS,
  type DayKey,
  type OperatingHours,
  type VirtualAssistantFaq,
  type VirtualAssistantLocation,
  type VirtualAssistantSettings,
} from "@/lib/virtual-assistant/types";
import {
  deleteVirtualAssistantFaq,
  deleteVirtualAssistantLocation,
  saveVirtualAssistantSettings,
  upsertVirtualAssistantFaq,
  upsertVirtualAssistantLocation,
} from "./actions";
import { AssistenteVirtualDiagnostics } from "./assistente-virtual-diagnostics";

type TabId =
  | "geral"
  | "empresa"
  | "localizacao"
  | "horarios"
  | "contato"
  | "politicas"
  | "faq"
  | "comportamento"
  | "diagnostico";

interface Props {
  canUse: boolean;
  initialSettings: Partial<VirtualAssistantSettings> | null;
  initialFaq: VirtualAssistantFaq[];
  initialLocations: VirtualAssistantLocation[];
  clinic: {
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    whatsapp_url: string | null;
    facebook_url: string | null;
    instagram_url: string | null;
    auto_message_send_start: string | null;
    auto_message_send_end: string | null;
  } | null;
}

export function AssistenteVirtualClient({
  canUse,
  initialSettings,
  initialFaq,
  initialLocations,
  clinic,
}: Props) {
  const [tab, setTab] = useState<TabId>("geral");
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(initialSettings?.enabled ?? false);
  const [assistantName, setAssistantName] = useState(initialSettings?.assistant_name ?? "Assistente");
  const [tone, setTone] = useState<"formal" | "informal">(initialSettings?.tone ?? "informal");
  const [useEmojis, setUseEmojis] = useState(initialSettings?.use_emojis !== false);
  const [debounce, setDebounce] = useState(String(initialSettings?.message_debounce_seconds ?? 5));
  const [segment, setSegment] = useState(initialSettings?.segment ?? "clinica");
  const [shortDescription, setShortDescription] = useState(initialSettings?.short_description ?? "");
  const [googleMaps, setGoogleMaps] = useState(initialSettings?.google_maps_url ?? "");
  const [parking, setParking] = useState(initialSettings?.parking_info ?? "");
  const [accessibility, setAccessibility] = useState(initialSettings?.accessibility_info ?? "");
  const [landmarks, setLandmarks] = useState(initialSettings?.landmarks ?? "");
  const [hasUnits, setHasUnits] = useState(initialSettings?.has_multiple_units ?? false);
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(
    (initialSettings?.operating_hours as OperatingHours) ?? DEFAULT_OPERATING_HOURS
  );
  const [holidayPolicy, setHolidayPolicy] = useState(initialSettings?.holiday_policy ?? "");
  const [phone, setPhone] = useState(clinic?.phone ?? "");
  const [email, setEmail] = useState(clinic?.email ?? "");
  const [address, setAddress] = useState(clinic?.address ?? "");
  const [whatsappUrl, setWhatsappUrl] = useState(clinic?.whatsapp_url ?? "");
  const [facebookUrl, setFacebookUrl] = useState(clinic?.facebook_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState(clinic?.instagram_url ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initialSettings?.website_url ?? "");
  const [humanHandoff, setHumanHandoff] = useState(initialSettings?.human_handoff_enabled !== false);
  const [paymentMethods, setPaymentMethods] = useState(
    (initialSettings?.payment_methods ?? []).join(", ")
  );
  const [cancellationPolicy, setCancellationPolicy] = useState(initialSettings?.cancellation_policy ?? "");
  const [avgWait, setAvgWait] = useState(initialSettings?.avg_wait_time ?? "");
  const [deliveryInfo, setDeliveryInfo] = useState(initialSettings?.delivery_info ?? "");
  const [promotions, setPromotions] = useState(initialSettings?.active_promotions ?? "");
  const [botStart, setBotStart] = useState(
    String(initialSettings?.bot_active_start ?? clinic?.auto_message_send_start ?? "08:00:00").slice(0, 5)
  );
  const [botEnd, setBotEnd] = useState(
    String(initialSettings?.bot_active_end ?? clinic?.auto_message_send_end ?? "20:00:00").slice(0, 5)
  );
  const [faq, setFaq] = useState(initialFaq);
  const [locations, setLocations] = useState(initialLocations);

  const tabs: { id: TabId; label: string }[] = [
    { id: "geral", label: "Geral" },
    { id: "empresa", label: "Sobre" },
    { id: "localizacao", label: "Localização" },
    { id: "horarios", label: "Horários" },
    { id: "contato", label: "Contato" },
    { id: "politicas", label: "Políticas" },
    { id: "faq", label: "FAQ" },
    { id: "comportamento", label: "Comportamento" },
    { id: "diagnostico", label: "Diagnóstico" },
  ];

  async function handleSave(partial?: Parameters<typeof saveVirtualAssistantSettings>[0]) {
    setSaving(true);
    const debounceNum = Number.parseInt(debounce, 10);
    const result = await saveVirtualAssistantSettings({
      enabled,
      assistant_name: assistantName.trim() || "Assistente",
      tone,
      use_emojis: useEmojis,
      segment: segment.trim() || "clinica",
      short_description: shortDescription.trim() || null,
      google_maps_url: googleMaps.trim() || null,
      parking_info: parking.trim() || null,
      accessibility_info: accessibility.trim() || null,
      landmarks: landmarks.trim() || null,
      has_multiple_units: hasUnits,
      human_handoff_enabled: humanHandoff,
      message_debounce_seconds: Number.isFinite(debounceNum) ? debounceNum : 5,
      operating_hours: operatingHours,
      holiday_policy: holidayPolicy.trim() || null,
      payment_methods: paymentMethods
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      cancellation_policy: cancellationPolicy.trim() || null,
      avg_wait_time: avgWait.trim() || null,
      delivery_info: deliveryInfo.trim() || null,
      active_promotions: promotions.trim() || null,
      website_url: websiteUrl.trim() || null,
      bot_active_start: botStart,
      bot_active_end: botEnd,
      clinic_contact: {
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        whatsapp_url: whatsappUrl.trim() || null,
        facebook_url: facebookUrl.trim() || null,
        instagram_url: instagramUrl.trim() || null,
      },
      ...partial,
    });
    setSaving(false);
    if (result.error) {
      toast(result.error, "error");
    } else {
      toast("Configurações salvas.", "success");
    }
  }

  return (
    <div className="space-y-4">
      {!canUse && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 text-sm text-amber-900">
            O assistente virtual está disponível em planos com WhatsApp ativo.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "geral" && (
        <Card>
          <CardHeader>
            <CardTitle>Ativação e personalidade</CardTitle>
            <CardDescription>
              Quando ativo, o assistente substitui o menu fixo do WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                disabled={!canUse}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Ativar assistente virtual no WhatsApp
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nome do atendente virtual</Label>
                <Input value={assistantName} onChange={(e) => setAssistantName(e.target.value)} />
              </div>
              <div>
                <Label>Tom de voz</Label>
                <Select value={tone} onChange={(e) => setTone(e.target.value as "formal" | "informal")}>
                  <option value="informal">Informal</option>
                  <option value="formal">Formal</option>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useEmojis} onChange={(e) => setUseEmojis(e.target.checked)} />
              Usar emojis nas respostas
            </label>
            <div>
              <Label>Aguardar antes de responder (segundos)</Label>
              <Input
                type="number"
                min={2}
                max={30}
                value={debounce}
                onChange={(e) => setDebounce(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Espera o paciente terminar de digitar mensagens em sequência.
              </p>
            </div>
            <Button onClick={() => handleSave()} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "empresa" && (
        <Card>
          <CardHeader>
            <CardTitle>Sobre a empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Segmento</Label>
              <Select value={segment} onChange={(e) => setSegment(e.target.value)}>
                <option value="clinica">Clínica / consultório</option>
                <option value="restaurante">Restaurante</option>
                <option value="loja">Loja</option>
                <option value="outro">Outro</option>
              </Select>
            </div>
            <div>
              <Label>Descrição curta</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border px-3 py-2 text-sm"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="O que a clínica faz, especialidades..."
              />
            </div>
            <Button onClick={() => handleSave()} disabled={saving}>
              Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "localizacao" && (
        <Card>
          <CardHeader>
            <CardTitle>Localização</CardTitle>
            <CardDescription>Endereço sincronizado com Dados da clínica.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Endereço</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <Label>Link Google Maps</Label>
              <Input value={googleMaps} onChange={(e) => setGoogleMaps(e.target.value)} />
            </div>
            <div>
              <Label>Estacionamento</Label>
              <Input value={parking} onChange={(e) => setParking(e.target.value)} />
            </div>
            <div>
              <Label>Acessibilidade</Label>
              <Input value={accessibility} onChange={(e) => setAccessibility(e.target.value)} />
            </div>
            <div>
              <Label>Pontos de referência</Label>
              <Input value={landmarks} onChange={(e) => setLandmarks(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hasUnits} onChange={(e) => setHasUnits(e.target.checked)} />
              Mais de uma unidade
            </label>
            {hasUnits && (
              <div className="space-y-3 border rounded-md p-3">
                <p className="text-sm font-medium">Unidades</p>
                {locations.map((loc) => (
                  <div key={loc.id} className="flex justify-between items-center text-sm border-b py-2">
                    <span>{loc.name} — {loc.address}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await deleteVirtualAssistantLocation(loc.id);
                        setLocations((prev) => prev.filter((l) => l.id !== loc.id));
                        toast("Unidade removida.", "success");
                      }}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const name = prompt("Nome da unidade");
                    if (!name) return;
                    const addr = prompt("Endereço") ?? "";
                    await upsertVirtualAssistantLocation(null, {
                      name,
                      address: addr,
                      display_order: locations.length,
                    });
                    toast("Unidade adicionada. Recarregue para ver.", "success");
                  }}
                >
                  Adicionar unidade
                </Button>
              </div>
            )}
            <Button onClick={() => handleSave()} disabled={saving}>
              Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "horarios" && (
        <Card>
          <CardHeader>
            <CardTitle>Horário de funcionamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(DAY_LABELS) as DayKey[]).map((day) => {
              const h = operatingHours[day] ?? {};
              return (
                <div key={day} className="grid gap-2 sm:grid-cols-5 items-end border-b pb-3">
                  <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={!!h.closed}
                      onChange={(e) =>
                        setOperatingHours((prev) => ({
                          ...prev,
                          [day]: { ...prev[day], closed: e.target.checked },
                        }))
                      }
                    />
                    Fechado
                  </label>
                  <Input
                    placeholder="Abre"
                    value={h.open ?? ""}
                    disabled={h.closed}
                    onChange={(e) =>
                      setOperatingHours((prev) => ({
                        ...prev,
                        [day]: { ...prev[day], open: e.target.value },
                      }))
                    }
                  />
                  <Input
                    placeholder="Fecha"
                    value={h.close ?? ""}
                    disabled={h.closed}
                    onChange={(e) =>
                      setOperatingHours((prev) => ({
                        ...prev,
                        [day]: { ...prev[day], close: e.target.value },
                      }))
                    }
                  />
                  <Input
                    placeholder="Almoço ex: 12:00-13:00"
                    value={h.lunch_start && h.lunch_end ? `${h.lunch_start}-${h.lunch_end}` : ""}
                    disabled={h.closed}
                    onChange={(e) => {
                      const [ls, le] = e.target.value.split("-");
                      setOperatingHours((prev) => ({
                        ...prev,
                        [day]: {
                          ...prev[day],
                          lunch_start: ls?.trim(),
                          lunch_end: le?.trim(),
                        },
                      }));
                    }}
                  />
                </div>
              );
            })}
            <div>
              <Label>Política de feriados</Label>
              <Input value={holidayPolicy} onChange={(e) => setHolidayPolicy(e.target.value)} />
            </div>
            <Button onClick={() => handleSave()} disabled={saving}>
              Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "contato" && (
        <Card>
          <CardHeader>
            <CardTitle>Contato e canais</CardTitle>
            <CardDescription>Sincronizado com Dados da clínica.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Site</Label>
                <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
              </div>
              <div>
                <Label>WhatsApp (link)</Label>
                <Input value={whatsappUrl} onChange={(e) => setWhatsappUrl(e.target.value)} />
              </div>
              <div>
                <Label>Instagram</Label>
                <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} />
              </div>
              <div>
                <Label>Facebook</Label>
                <Input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={humanHandoff}
                onChange={(e) => setHumanHandoff(e.target.checked)}
              />
              Permitir transferência para atendente humano
            </label>
            <Button onClick={() => handleSave()} disabled={saving}>
              Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "politicas" && (
        <Card>
          <CardHeader>
            <CardTitle>Políticas operacionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Formas de pagamento (separadas por vírgula)</Label>
              <Input value={paymentMethods} onChange={(e) => setPaymentMethods(e.target.value)} />
            </div>
            <div>
              <Label>Cancelamento / reembolso</Label>
              <textarea
                className="w-full min-h-[60px] rounded-md border px-3 py-2 text-sm"
                value={cancellationPolicy}
                onChange={(e) => setCancellationPolicy(e.target.value)}
              />
            </div>
            <div>
              <Label>Tempo médio de espera</Label>
              <Input value={avgWait} onChange={(e) => setAvgWait(e.target.value)} />
            </div>
            {segment !== "clinica" && (
              <div>
                <Label>Delivery / entrega</Label>
                <Input value={deliveryInfo} onChange={(e) => setDeliveryInfo(e.target.value)} />
              </div>
            )}
            <div>
              <Label>Promoções ativas</Label>
              <textarea
                className="w-full min-h-[60px] rounded-md border px-3 py-2 text-sm"
                value={promotions}
                onChange={(e) => setPromotions(e.target.value)}
              />
            </div>
            <Button onClick={() => handleSave()} disabled={saving}>
              Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "faq" && (
        <Card>
          <CardHeader>
            <CardTitle>Perguntas frequentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {faq.map((item) => (
              <div key={item.id} className="border rounded-md p-3 space-y-2">
                <p className="text-sm font-medium">{item.question}</p>
                <p className="text-sm text-muted-foreground">{item.answer}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await deleteVirtualAssistantFaq(item.id);
                    setFaq((prev) => prev.filter((f) => f.id !== item.id));
                    toast("FAQ removida.", "success");
                  }}
                >
                  Remover
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={async () => {
                const question = prompt("Pergunta");
                if (!question) return;
                const answer = prompt("Resposta") ?? "";
                await upsertVirtualAssistantFaq(null, question, answer, faq.length);
                toast("FAQ adicionada. Recarregue para ver.", "success");
              }}
            >
              Adicionar FAQ
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "comportamento" && (
        <Card>
          <CardHeader>
            <CardTitle>Horário do bot</CardTitle>
            <CardDescription>Fora deste horário, o bot envia mensagem educada de indisponibilidade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Início</Label>
                <Input type="time" value={botStart} onChange={(e) => setBotStart(e.target.value)} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="time" value={botEnd} onChange={(e) => setBotEnd(e.target.value)} />
              </div>
            </div>
            <Button onClick={() => handleSave()} disabled={saving}>
              Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "diagnostico" && <AssistenteVirtualDiagnostics active={tab === "diagnostico"} />}
    </div>
  );
}
