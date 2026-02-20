-- Estado do chatbot para fluxo de menu (1 Agendar, 2 Remarcar, etc.)
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS chatbot_step text;

COMMENT ON COLUMN public.whatsapp_conversations.chatbot_step IS 'Estado do chatbot: null = menu inicial, awaiting_procedure = aguardando escolha de procedimento, done = já atribuído/saiu do chatbot';
