# Auditoria WhatsApp: cobertura e fidelidade

## Resultado da varredura

- Fluxo auditado: seleção de template, renderização de variáveis, decisão janela 24h, envio Meta e preview.
- Arquivos centrais: `lib/message-processor.ts`, `lib/whatsapp-meta-templates.ts`, `lib/comunicacao/whatsapp.ts`.
- Cobertura de eventos WhatsApp no mapeamento Meta: completa para todos os eventos do sistema que podem usar WhatsApp.

## Matriz de cobertura (event_code -> template Meta)

| Event code | Template Meta canônico |
| --- | --- |
| `appointment_created` | `flowmedi_consulta` |
| `appointment_rescheduled` | `flowmedi_consulta` |
| `appointment_confirmed` | `flowmedi_consulta` |
| `appointment_not_confirmed` | `flowmedi_consulta` |
| `appointment_reminder_30d` | `flowmedi_consulta` |
| `appointment_reminder_15d` | `flowmedi_consulta` |
| `appointment_reminder_7d` | `flowmedi_consulta` |
| `appointment_reminder_48h` | `flowmedi_consulta` |
| `appointment_reminder_24h` | `flowmedi_consulta` |
| `appointment_reminder_2h` | `flowmedi_consulta` |
| `return_appointment_reminder` | `flowmedi_consulta` |
| `appointment_marked_as_return` | `flowmedi_consulta` |
| `form_linked` | `flowmedi_formulario` |
| `form_link_sent` | `flowmedi_formulario` |
| `form_reminder` | `flowmedi_formulario` |
| `form_incomplete` | `flowmedi_formulario` |
| `appointment_canceled` | `flowmedi_aviso` |
| `appointment_no_show` | `flowmedi_aviso` |
| `appointment_completed` | `flowmedi_aviso` |
| `form_completed` | `flowmedi_aviso` |
| `patient_form_completed` | `flowmedi_aviso` |
| `public_form_completed` | `flowmedi_aviso` |
| `patient_registered` | `flowmedi_aviso` |

## Riscos encontrados

1. **Divergência preview x envio**: preview usava texto fixo local para template Meta e podia divergir do corpo aprovado na Meta.
2. **Terminologia inconsistente**: mensagens ao paciente com "Médico(a)" e variações "dr" em alguns textos.
3. **Fidelidade por evento**: com apenas 3 templates canônicos, textos muito específicos por evento dependem do campo `whatsapp_meta_phrase` e dos parâmetros, não de um template exclusivo por evento.

## Ações implementadas nesta entrega

- Preview Meta agora busca `components` do template aprovado na Meta e renderiza com os parâmetros reais.
- Fallback de preview foi centralizado em `lib/whatsapp-meta-templates.ts` para reduzir divergência quando a Meta não retorna corpo.
- Padronização textual para "Profissional" em mensagens de consulta no caminho Meta/fallback.
- Migration de conteúdo criada para atualizar bases já em produção.

## Critério para abrir novos templates no Meta

Criar novos templates Meta quando ao menos uma condição ocorrer:

- Necessidade de texto fixo diferente por evento que não caiba em `{{2}}`.
- Necessidade de componentes extras (header, footer, botão, CTA) por evento.
- Necessidade regulatória/jurídica de redação fixa por tipo de comunicação.
- Reprovação recorrente da Meta por template genérico para um tipo de mensagem.
