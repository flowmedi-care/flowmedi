export type PlaygroundPreset = {
  id: string;
  label: string;
  description: string;
  toolName?: string;
  phone?: string;
  aiState?: Record<string, unknown>;
  formValues?: Record<string, string>;
  executorMode?: "production" | "full";
};

export const PLAYGROUND_PRESETS: PlaygroundPreset[] = [
  {
    id: "lookup-patient",
    label: "Buscar paciente",
    description: "Telefone com paciente cadastrado → lookup_patient_by_phone",
    toolName: "lookup_patient_by_phone",
    phone: "5511999999999",
  },
  {
    id: "no-patient",
    label: "Sem paciente",
    description: "Telefone inexistente para testar cadastro",
    toolName: "register_patient",
    phone: "5511888888888",
    formValues: { full_name: "Paciente Teste Playground" },
  },
  {
    id: "list-doctors",
    label: "Listar médicos",
    description: "Primeiro passo do fluxo de agendamento",
    toolName: "list_doctors",
    phone: "5511999999999",
  },
  {
    id: "booking-flow",
    label: "Fluxo agendamento",
    description: "Estado parcial de booking + buscar horários",
    toolName: "find_available_slots",
    phone: "5511999999999",
    aiState: {
      booking: { status: "collecting" },
    },
  },
  {
    id: "invalid-slot",
    label: "Slot inválido",
    description: "scheduled_at fora de offered_slots (deve falhar)",
    toolName: "create_appointment",
    phone: "5511999999999",
    aiState: {
      booking: {
        status: "confirming",
        offered_slots: [
          { scheduled_at: "2026-12-01T10:00:00-03:00", display: "01/12 10:00" },
        ],
      },
    },
    formValues: {
      scheduled_at: "2026-12-01T15:00:00-03:00",
    },
  },
  {
    id: "list-appointments",
    label: "Consultas do paciente",
    description: "Listar consultas futuras",
    toolName: "list_patient_appointments",
    phone: "5511999999999",
  },
];
