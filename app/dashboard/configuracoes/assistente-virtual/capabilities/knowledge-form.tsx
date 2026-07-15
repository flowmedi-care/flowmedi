"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { CapabilityFormProps } from "@/lib/assistant-capabilities/types";
import type { KnowledgeAclSettings } from "@/lib/assistant-capabilities/knowledge/types";
import { listInformationSources } from "@/lib/assistant-platform/information-sources/registry";

function SourceBlock({
  title,
  enabled,
  onEnabled,
  editHref,
  children,
  disabled,
}: {
  title: string;
  enabled: boolean;
  onEnabled: (v: boolean) => void;
  editHref: string;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(enabled);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={disabled}
              checked={enabled}
              onChange={(e) => onEnabled(e.target.checked)}
            />
            Habilitado
          </label>
          {children}
          <Link
            href={editHref}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Editar → <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function FieldChecks({
  fields,
  labels,
  value,
  onChange,
  disabled,
}: {
  fields: string[];
  labels: Record<string, string>;
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {fields.map((key) => (
        <label key={key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={disabled || !value}
            checked={Boolean(value[key])}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          {labels[key] ?? key}
        </label>
      ))}
    </div>
  );
}

const CLINIC_LABELS: Record<string, string> = {
  address: "Endereço",
  hours: "Horário",
  parking: "Estacionamento",
  accessibility: "Acessibilidade",
  units: "Unidades",
  phones: "Telefones",
  social: "Redes sociais",
  conventions: "Convênios",
  promotions: "Promoções",
  paymentMethods: "Formas de pagamento",
};

const PROC_LABELS: Record<string, string> = {
  list: "Listar",
  shortDescription: "Descrição curta",
  howWePerform: "Como realizamos",
  prep: "Preparo",
  duration: "Duração",
  recovery: "Recuperação",
  supplies: "Insumos",
};

const SERVICE_LABELS: Record<string, string> = {
  list: "Listar",
  explainDifferences: "Explicar diferenças",
  showPrices: "Mostrar preços",
  showDimensionVariants: "Variações por dimensão",
};

export function KnowledgeCapabilityForm({
  value,
  onChange,
  disabled,
}: CapabilityFormProps<KnowledgeAclSettings>) {
  const sources = listInformationSources();
  const clinicSrc = sources.find((s) => s.id === "clinic")!;
  const procSrc = sources.find((s) => s.id === "procedures")!;
  const svcSrc = sources.find((s) => s.id === "services")!;
  const kbSrc = sources.find((s) => s.id === "knowledge_base")!;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Escolha quais fontes a IA pode consultar. O conteúdo é editado nos módulos de origem — aqui
        só a governança.
      </p>

      <SourceBlock
        title={clinicSrc.displayName}
        enabled={value.clinic.enabled}
        onEnabled={(enabled) =>
          onChange({ ...value, clinic: { ...value.clinic, enabled } })
        }
        editHref={clinicSrc.editHref}
        disabled={disabled}
      >
        <FieldChecks
          fields={Object.keys(CLINIC_LABELS)}
          labels={CLINIC_LABELS}
          value={value.clinic.fields}
          onChange={(fields) =>
            onChange({
              ...value,
              clinic: { ...value.clinic, fields: fields as typeof value.clinic.fields },
            })
          }
          disabled={disabled || !value.clinic.enabled}
        />
      </SourceBlock>

      <SourceBlock
        title={procSrc.displayName}
        enabled={value.procedures.enabled}
        onEnabled={(enabled) =>
          onChange({ ...value, procedures: { ...value.procedures, enabled } })
        }
        editHref={procSrc.editHref}
        disabled={disabled}
      >
        <FieldChecks
          fields={Object.keys(PROC_LABELS)}
          labels={PROC_LABELS}
          value={value.procedures.fields}
          onChange={(fields) =>
            onChange({
              ...value,
              procedures: {
                ...value.procedures,
                fields: fields as typeof value.procedures.fields,
              },
            })
          }
          disabled={disabled || !value.procedures.enabled}
        />
      </SourceBlock>

      <SourceBlock
        title={svcSrc.displayName}
        enabled={value.services.enabled}
        onEnabled={(enabled) =>
          onChange({ ...value, services: { ...value.services, enabled } })
        }
        editHref={svcSrc.editHref}
        disabled={disabled}
      >
        <FieldChecks
          fields={Object.keys(SERVICE_LABELS)}
          labels={SERVICE_LABELS}
          value={value.services.fields}
          onChange={(fields) =>
            onChange({
              ...value,
              services: { ...value.services, fields: fields as typeof value.services.fields },
            })
          }
          disabled={disabled || !value.services.enabled}
        />
      </SourceBlock>

      <SourceBlock
        title={kbSrc.displayName}
        enabled={value.knowledge_base.enabled}
        onEnabled={(enabled) => onChange({ ...value, knowledge_base: { enabled } })}
        editHref={kbSrc.editHref}
        disabled={disabled}
      >
        <p className="text-xs text-muted-foreground">
          Quando o paciente fizer perguntas parecidas, a IA usará as respostas da base. Não edite o
          conteúdo aqui.
        </p>
      </SourceBlock>
    </div>
  );
}
