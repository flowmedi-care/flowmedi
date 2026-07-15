"use client";

import type { CapabilityFormProps } from "@/lib/assistant-capabilities/types";
import type { BookingSettings, GoalLevel } from "@/lib/assistant-capabilities/booking/types";
import { ComingSoon } from "./coming-soon";

function LevelRadios({
  name,
  label,
  value,
  onChange,
  disabled,
}: {
  name: string;
  label: string;
  value: GoalLevel;
  onChange: (v: GoalLevel) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-4 text-sm">
        {(["ignore", "optional", "required"] as const).map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name={name}
              disabled={disabled}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt === "ignore" ? "Ignorar" : opt === "optional" ? "Opcional" : "Obrigatório"}
          </label>
        ))}
      </div>
    </div>
  );
}

export function BookingCapabilityForm({
  value,
  onChange,
  disabled,
}: CapabilityFormProps<BookingSettings>) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold">Consultas</h3>
        <p className="mb-2 text-xs text-muted-foreground">O assistente pode</p>
        <div className="space-y-2 text-sm">
          {(
            [
              ["allowBooking", "Agendar consultas"],
              ["allowReschedule", "Remarcar consultas"],
              ["allowCancellation", "Cancelar consultas"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={disabled}
                checked={value[key]}
                onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Fluxo</h3>
        <p className="mb-2 text-xs text-muted-foreground">Como ele deve agendar</p>
        <div className="space-y-2 text-sm">
          {(
            [
              ["express", "Livre"],
              ["assisted", "Assistido"],
              ["strict", "Estrito"],
            ] as const
          ).map(([id, label]) => (
            <label key={id} className="flex items-center gap-2">
              <input
                type="radio"
                name="bookingMode"
                disabled={disabled}
                checked={value.mode === id}
                onChange={() => onChange({ ...value, mode: id })}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Dados do paciente</h3>
        <p className="mb-2 text-xs text-muted-foreground">Quais informações ele deve solicitar</p>
        <LevelRadios
          name="patient"
          label="Nome / identificação"
          value={value.patientInformation.patient}
          disabled={disabled}
          onChange={(patient) =>
            onChange({
              ...value,
              patientInformation: { ...value.patientInformation, patient },
            })
          }
        />
        <LevelRadios
          name="cpf"
          label="CPF"
          value={value.patientInformation.cpf}
          disabled={disabled}
          onChange={(cpf) =>
            onChange({
              ...value,
              patientInformation: { ...value.patientInformation, cpf },
            })
          }
        />
        <LevelRadios
          name="email"
          label="E-mail"
          value={value.patientInformation.email}
          disabled={disabled}
          onChange={(email) =>
            onChange({
              ...value,
              patientInformation: { ...value.patientInformation, email },
            })
          }
        />
        <LevelRadios
          name="guardian"
          label="Responsável"
          value={value.patientInformation.guardian}
          disabled={disabled}
          onChange={(guardian) =>
            onChange({
              ...value,
              patientInformation: { ...value.patientInformation, guardian },
            })
          }
        />
        <LevelRadios
          name="doctor"
          label="Médico"
          value={value.appointmentInformation.doctor}
          disabled={disabled}
          onChange={(doctor) =>
            onChange({
              ...value,
              appointmentInformation: { ...value.appointmentInformation, doctor },
            })
          }
        />
        <LevelRadios
          name="procedure"
          label="Procedimento"
          value={value.appointmentInformation.procedure}
          disabled={disabled}
          onChange={(procedure) =>
            onChange({
              ...value,
              appointmentInformation: { ...value.appointmentInformation, procedure },
            })
          }
        />
        <LevelRadios
          name="schedule"
          label="Horário"
          value={value.appointmentInformation.schedule}
          disabled={disabled}
          onChange={(schedule) =>
            onChange({
              ...value,
              appointmentInformation: { ...value.appointmentInformation, schedule },
            })
          }
        />
        <LevelRadios
          name="reason"
          label="Motivo do cancelamento"
          value={value.cancellationInformation.reason}
          disabled={disabled}
          onChange={(reason) =>
            onChange({
              ...value,
              cancellationInformation: { ...value.cancellationInformation, reason },
            })
          }
        />
      </section>

      <ComingSoon
        items={[
          { id: "lead", label: "Antecedência mínima / máxima" },
          { id: "encaixe", label: "Permitir encaixe" },
          { id: "fila", label: "Fila de espera" },
          { id: "confirm", label: "Confirmação de consulta" },
          { id: "reminder", label: "Lembretes" },
        ]}
      />
    </div>
  );
}
