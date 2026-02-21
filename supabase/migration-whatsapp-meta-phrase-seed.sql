-- Migration: Popular whatsapp_meta_phrase nos templates sistema (WhatsApp)
-- Execute APÓS migration-whatsapp-meta-template-phrase.sql

UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Confirmamos o agendamento da sua consulta.' WHERE event_code = 'appointment_created' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Informamos que sua consulta foi remarcada.' WHERE event_code = 'appointment_rescheduled' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Recebemos sua confirmação. Sua consulta está agendada.' WHERE event_code = 'appointment_confirmed' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Sua consulta ainda não foi confirmada. Por favor, confirme sua presença ou entre em contato.' WHERE event_code = 'appointment_not_confirmed' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Lembramos que você tem consulta agendada em 30 dias.' WHERE event_code = 'appointment_reminder_30d' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Lembramos que sua consulta está agendada em 15 dias.' WHERE event_code = 'appointment_reminder_15d' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Lembramos que sua consulta é na próxima semana.' WHERE event_code = 'appointment_reminder_7d' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Sua consulta está agendada para daqui a 48 horas.' WHERE event_code = 'appointment_reminder_48h' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Lembramos que sua consulta é amanhã.' WHERE event_code = 'appointment_reminder_24h' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Sua consulta é em 2 horas.' WHERE event_code = 'appointment_reminder_2h' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Lembramos que você tem consulta de retorno agendada.' WHERE event_code = 'return_appointment_reminder' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Informamos que sua consulta foi marcada como retorno.' WHERE event_code = 'appointment_marked_as_return' AND channel = 'whatsapp';

UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Precisamos que você preencha um formulário antes da sua consulta.' WHERE event_code = 'form_linked' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Enviamos o link para que você preencha o formulário antes da sua consulta.' WHERE event_code = 'form_link_sent' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Lembramos que você ainda precisa preencher o formulário vinculado à sua consulta.' WHERE event_code = 'form_reminder' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'O formulário não foi preenchido completamente. Por favor, complete todos os campos.' WHERE event_code = 'form_incomplete' AND channel = 'whatsapp';

UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Informamos que sua consulta foi cancelada. Para reagendar, entre em contato conosco.' WHERE event_code = 'appointment_canceled' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Registramos que você não pôde comparecer à consulta. Para reagendar, entre em contato conosco.' WHERE event_code = 'appointment_no_show' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Obrigado por comparecer à consulta. Foi um prazer atendê-lo(a).' WHERE event_code = 'appointment_completed' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Muito obrigado por preencher o formulário. Recebemos suas informações.' WHERE event_code = 'form_completed' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Muito obrigado por preencher o formulário. Recebemos suas informações.' WHERE event_code = 'patient_form_completed' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Obrigado por entrar em contato. Recebemos suas informações e em breve entraremos em contato.' WHERE event_code = 'public_form_completed' AND channel = 'whatsapp';
UPDATE public.system_message_templates SET whatsapp_meta_phrase = 'Bem-vindo à nossa clínica. Você foi cadastrado em nosso sistema e em breve poderá agendar sua primeira consulta.' WHERE event_code = 'patient_registered' AND channel = 'whatsapp';
