export const CONFIRMATION_FLOW_NAME = "flowmedi_confirmacao";
export const CONFIRMATION_FLOW_TEMPLATE_KEY = "flowmedi_confirmacao_flow";
export const CONFIRMATION_FLOW_BUTTON_TEXT = "Confirmar consulta";

export const CONFIRMATION_FLOW_TEMPLATE_BODY =
  "Olá {{1}}!\n\nPrecisamos confirmar sua presença na consulta agendada:\n\n{{2}}\n\nToque no botão abaixo para confirmar, cancelar ou remarcar sua consulta.";

export const CONFIRMATION_FLOW_BODY_EXAMPLES = [
  "Maria",
  "Sua consulta está agendada para segunda-feira, 15/03, às 14:00 com Dr. Silva.",
] as const;

export function getConfirmationFlowDefinition(): Record<string, unknown> {
  return {
    version: "7.2",
    screens: [
      {
        id: "CONFIRM_SCREEN",
        title: "Confirmar consulta",
        terminal: true,
        data: {
          medico: { type: "string", __example__: "Dr. Silva" },
          data_consulta: { type: "string", __example__: "segunda-feira, 15/03" },
          hora_consulta: { type: "string", __example__: "14:00" },
          procedimento: { type: "string", __example__: "Consulta" },
        },
        layout: {
          type: "SingleColumnLayout",
          children: [
            {
              type: "TextHeading",
              text: "Sua consulta",
            },
            {
              type: "TextBody",
              text: "`${data.data_consulta} ' às ' ${data.hora_consulta}`",
            },
            {
              type: "TextBody",
              text: "${data.medico}",
            },
            {
              type: "TextBody",
              text: "${data.procedimento}",
            },
            {
              type: "RadioButtonsGroup",
              name: "acao",
              label: "O que deseja fazer?",
              required: true,
              "data-source": [
                { id: "confirmar", title: "Confirmar presença" },
                { id: "cancelar", title: "Não vou / cancelar" },
                { id: "remarcar", title: "Remarcar" },
              ],
            },
            {
              type: "Footer",
              label: "Enviar",
              "on-click-action": {
                name: "complete",
                payload: {
                  action: "${form.acao}",
                },
              },
            },
          ],
        },
      },
    ],
  };
}

export function getConfirmationFlowJsonString(): string {
  return JSON.stringify(getConfirmationFlowDefinition());
}

export function buildConfirmationFlowTemplateComponents(
  bodyText: string,
  flowId: string,
  flowButtonText: string = CONFIRMATION_FLOW_BUTTON_TEXT
): Array<Record<string, unknown>> {
  return [
    {
      type: "BODY",
      text: bodyText,
      example: {
        body_text: [Array.from(CONFIRMATION_FLOW_BODY_EXAMPLES)],
      },
    },
    {
      type: "BUTTONS",
      buttons: [
        {
          type: "FLOW",
          text: flowButtonText,
          flow_id: flowId,
          flow_action: "navigate",
        },
      ],
    },
  ];
}
