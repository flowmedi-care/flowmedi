# ROPA — Registro de Operações de Tratamento (modelo FlowMed)

**Versão:** 2026-07-02 | **Art. 37 LGPD**

| # | Operação | Controlador | Operador | Dados | Titulares | Finalidade | Base legal | Retenção | Subprocessadores |
|---|----------|-------------|----------|-------|-----------|------------|------------|----------|------------------|
| 1 | Cadastro de clínica | FlowMed | Supabase, Stripe | Nome, e-mail, senha, billing | Admin clínica | Conta e cobrança | Contrato (art. 7º, V) | Vigência + legal | Supabase, Stripe, Vercel |
| 2 | Gestão de pacientes | Clínica | FlowMed | PII + saúde | Pacientes | Atendimento | Art. 11 II,f / consentimento | Prontuário (CFM) | Supabase |
| 3 | Agenda e consultas | Clínica | FlowMed | PII, saúde operacional | Pacientes | Agendamento | Contrato saúde | Conforme clínica | Supabase |
| 4 | Formulários clínicos | Clínica | FlowMed | Saúde sensível | Pacientes | Anamnese | Art. 11 | Conforme clínica | Supabase |
| 5 | WhatsApp / e-mail | Clínica | FlowMed, Meta, Google | Contato, mensagens | Pacientes | Comunicação | Contrato / consentimento marketing | Logs operacionais | Meta, Google |
| 6 | Assistente virtual IA | Clínica | FlowMed, OpenAI | Mensagens WhatsApp | Pacientes | Agendamento | Contrato / informação | Logs AI events | OpenAI |
| 7 | Transcrição consulta | Clínica | FlowMed, ViaProve | Áudio, texto | Pacientes | Prontuário | Art. 11 | Conforme clínica | ViaProve |
| 8 | Auditoria plataforma | Clínica | FlowMed | Ações usuários | Staff | Segurança | Legítimo interesse (art. 7º, IX) | Definir política | Supabase |
| 9 | Site institucional FlowMed | FlowMed | Vercel | Logs, cookies sessão | Visitantes | Marketing produto | Legítimo interesse | Logs técnicos | Vercel |

**Manutenção:** revisar trimestralmente ou a cada nova funcionalidade/subprocessador.
