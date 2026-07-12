import type { ChatbotToolName } from "../definitions";

/**
 * Compact OpenAI description field — generated from tool-docs/*.md (source of truth).
 * When updating docs, sync the matching entry here.
 */
export const TOOL_DESCRIPTIONS: Record<ChatbotToolName, string> = {
  lookup_patient_by_phone:
    "Purpose: Verificar se paciente está cadastrado pelo telefone WhatsApp (automático).\n" +
    "When to use: início de agendamento; antes de create_appointment; cancelar/remarcar.\n" +
    "When NOT: se patient_id já no contexto; para cadastrar (use register_patient).\n" +
    "Output success: found, patient_id, display_name. Se found=false → register_patient após nome.",

  register_patient:
    "Purpose: Cadastrar novo paciente. Telefone vem da conversa — nunca peça telefone.\n" +
    "When to use: lookup retornou found=false e paciente informou nome completo.\n" +
    "When NOT: paciente já cadastrado; sem nome completo.\n" +
    "Output success: patientId.",

  update_patient_intake:
    "Purpose: Persistir dados coletados do paciente (CPF, convênio, pagamento, campos custom).\n" +
    "When to use: após paciente informar dado de intake no fluxo conversacional.\n" +
    "When NOT: cadastro inicial (register_patient); agendamento (create_appointment).\n" +
    "Output success: updated=true.",

  list_procedures:
    "Purpose: Listar procedimentos da clínica (id, nome, duração).\n" +
    "When to use: discovery (\"o que vocês fazem?\"); início de booking; paciente não sabe procedimento.\n" +
    "When NOT: paciente já disse procedimento; preços (get_service_price); horários (find_available_slots).\n" +
    "Output success: data.procedures + options numeradas (1,2,3). Resposta \"2\" → options[2].id.",

  list_doctors:
    "Purpose: Listar médicos (id, nome, especialidade).\n" +
    "When to use: após procedimento definido; paciente pergunta quem atende.\n" +
    "When NOT: paciente já nomeou médico — faça match por nome na lista.\n" +
    "Output success: data.doctors + options numeradas. Resposta \"1\" → options[1].id.",

  find_available_slots:
    "Purpose: Buscar disponibilidade de horários. Requer doctor_id + procedure_id.\n" +
    "When to use: após médico e procedimento; paciente pergunta vagas ou escolhe dia/turno (\"segunda de manhã\").\n" +
    "When NOT: antes de list_doctors/list_procedures; para listar médicos/procedimentos.\n" +
    "Inputs: date (YYYY-MM-DD) → mode=times; sem date → mode=days; period=manha|tarde; skip_days para \"outros dias\".\n" +
    "Failure modes: needs_input sem doctor/procedure; unavailable sem vagas (re-chame com skip_days ou outro period).\n" +
    "Output success: data.days|slots + options numeradas.",

  create_appointment:
    "Purpose: Criar agendamento confirmado. Operação irreversível.\n" +
    "When to use: APENAS após confirmação explícita (\"sim\", \"isso\", \"pode marcar\") E horário de offered_slots.\n" +
    "When NOT: antes de find_available_slots; sem confirmação; scheduled_at inventado ou fora de offered_slots.\n" +
    "NUNCA invente scheduled_at — use valor exato retornado por find_available_slots.\n" +
    "Output success: appointment_id, created=true.",

  list_patient_appointments:
    "Purpose: Listar consultas do paciente (telefone da conversa).\n" +
    "When to use: \"minhas consultas\"; \"consulta agendada\"; antes de cancel/reschedule.\n" +
    "When NOT: agendar nova consulta.\n" +
    "Output success: data.appointments + options (1..N na mesma ordem). Nunca invente consultas.\n" +
    "Contrato: appointments[i] = opção i+1; renderStrategy=appointment_list (lista autoritativa).",

  cancel_appointment:
    "Purpose: Cancelar consulta existente.\n" +
    "When to use: paciente quer cancelar (não remarcar). Confirme antes.\n" +
    "When NOT: remarcar → use cancellation_reason=reschedule.\n" +
    "Output success: cancelled=true.",

  reschedule_appointment:
    "Purpose: Remarcar consulta para novo horário.\n" +
    "When to use: após find_available_slots e confirmação do paciente.\n" +
    "When NOT: new_scheduled_at inventado — deve vir de find_available_slots.\n" +
    "Output success: rescheduled=true.",

  get_service_price:
    "Purpose: Consultar preço exato de procedimento para um médico.\n" +
    "When to use: \"quanto custa?\", \"qual o valor?\", perguntas de preço.\n" +
    "When NOT: listar serviços (list_procedures); políticas/endereço (search_faq); horários (find_available_slots).\n" +
    "Requires: doctor_id + procedure_id (do contexto ou parâmetros).\n" +
    "Output success: valor em data.",

  search_faq:
    "Purpose: Buscar resposta em FAQ cadastrada (horário, endereço, estacionamento, políticas).\n" +
    "When to use: dúvidas institucionais da clínica.\n" +
    "When NOT: preços (get_service_price); procedimentos (list_procedures); vagas (find_available_slots).\n" +
    "Failure modes: not_found se FAQ não tem entrada — informe paciente e tente tool específica; NÃO transfira para humano.\n" +
    "Output success: question + answer.",

  transfer_to_human:
    "Purpose: Transferir para atendente humano.\n" +
    "When to use APENAS: pedido EXPLÍCITO de humano/atendente; reclamação formal (Procon/advogado); impossibilidade técnica real.\n" +
    "When NOT: durante booking ativo; dúvida resolvível com outras tools; paciente escolhe opção (\"1\",\"2\",\"marca qualquer um\").\n" +
    "NUNCA use porque paciente disse \"marca qualquer um\" — escolha primeira opção disponível e continue.\n" +
    "Output success: transferred=true.",
};
