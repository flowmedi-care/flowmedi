"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { CapabilityFormProps } from "@/lib/assistant-capabilities/types";
import type { BookingSettings } from "@/lib/assistant-capabilities/booking/types";
import type { CheckInSettings } from "@/lib/assistant-capabilities/check-in/types";
import { BookingCapabilityForm } from "./booking-form";
import { CheckInCapabilityForm } from "./check-in-form";

export type AttendanceSettings = {
  booking: BookingSettings;
  checkIn: CheckInSettings;
};

function AccordionItem({
  title,
  enabled,
  onEnabled,
  children,
  disabled,
}: {
  title: string;
  enabled: boolean;
  onEnabled: (v: boolean) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
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
        </div>
      ) : null}
    </div>
  );
}

export function AttendanceCapabilityForm({
  value,
  onChange,
  disabled,
}: CapabilityFormProps<AttendanceSettings>) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Capacidades de atendimento. Expanda cada item para ajustar modo e campos.
      </p>

      <AccordionItem
        title="Agendamento"
        enabled={value.booking.allowBooking}
        onEnabled={(allowBooking) =>
          onChange({ ...value, booking: { ...value.booking, allowBooking } })
        }
        disabled={disabled}
      >
        <BookingCapabilityForm
          value={value.booking}
          onChange={(booking) => onChange({ ...value, booking })}
          disabled={disabled}
        />
      </AccordionItem>

      <AccordionItem
        title="Check-in"
        enabled={value.checkIn.enabled}
        onEnabled={(enabled) =>
          onChange({ ...value, checkIn: { ...value.checkIn, enabled } })
        }
        disabled={disabled}
      >
        <CheckInCapabilityForm
          value={value.checkIn}
          onChange={(checkIn) => onChange({ ...value, checkIn })}
          disabled={disabled}
        />
      </AccordionItem>

      <AccordionItem
        title="Cancelamento"
        enabled={value.booking.allowCancellation}
        onEnabled={(allowCancellation) =>
          onChange({ ...value, booking: { ...value.booking, allowCancellation } })
        }
        disabled={disabled}
      >
        <p className="text-xs text-muted-foreground">
          Detalhes de motivo e política ficam no formulário de Agendamento (cancelamento).
        </p>
      </AccordionItem>

      <AccordionItem
        title="Remarcação"
        enabled={value.booking.allowReschedule}
        onEnabled={(allowReschedule) =>
          onChange({ ...value, booking: { ...value.booking, allowReschedule } })
        }
        disabled={disabled}
      >
        <p className="text-xs text-muted-foreground">
          Modo e regras de remarcação seguem o fluxo de Agendamento.
        </p>
      </AccordionItem>

      <div className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
        ▸ Pós-consulta — em breve
      </div>
    </div>
  );
}
