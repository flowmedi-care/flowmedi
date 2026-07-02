# ROPA — Registro de Operações de Tratamento (vivo)

**Versão:** 2026-07-02 | **Art. 37 LGPD**  
**Responsável:** Encarregado | **Revisão:** trimestral (`ROPA-REVISAO-TRIMESTRAL.md`)

| # | Operação | Controlador | Operador | Dados | Titulares | Finalidade | Base legal | Retenção | Subprocessadores |
|---|----------|-------------|----------|-------|-----------|------------|------------|----------|------------------|
| 1 | Cadastro de clínica | FlowMed | Supabase, Stripe | Nome, e-mail, senha, billing | Admin clínica | Conta e cobrança | Contrato (art. 7º, V) | Vigência + 3 anos | Supabase, Stripe, Vercel |
| 2 | Aceite DPA onboarding | Clínica | FlowMed | IP, user-agent, versão DPA | Admin clínica | Prova contratual | Contrato (art. 7º, V) | Vigência + legal | Supabase |
| 3 | Gestão de pacientes | Clínica | FlowMed | PII + saúde | Pacientes | Atendimento | Art. 11 II,f | Prontuário CFM | Supabase |
| 4 | Agenda e consultas | Clínica | FlowMed | PII, saúde operacional | Pacientes | Agendamento | Art. 11 II,f | Conforme clínica | Supabase |
| 5 | Formulários clínicos (públicos e vinculados) | Clínica | FlowMed | Saúde sensível | Pacientes | Anamnese | Art. 11 II,f + aviso | Conforme clínica | Supabase |
| 6 | CRM / captação | Clínica | FlowMed | PII, interesse comercial | Leads | Pré-atendimento | Legítimo interesse / consentimento | Conforme clínica | Supabase |
| 7 | WhatsApp / e-mail | Clínica | FlowMed, Meta, Google | Contato, mensagens | Pacientes | Comunicação | Contrato / consentimento marketing | Logs 24m (padrão) | Meta, Google |
| 8 | Assistente virtual IA | Clínica | FlowMed, OpenAI | Mensagens WhatsApp | Pacientes | Agendamento | Contrato + informação | Logs AI 24m | OpenAI |
| 9 | Transcrição consulta | Clínica | FlowMed, ViaProve | Áudio, texto | Pacientes | Prontuário | Art. 11 II,f | Conforme clínica | ViaProve |
| 10 | Exames (upload) | Clínica | FlowMed | Arquivos clínicos | Pacientes | Diagnóstico | Art. 11 II,f | Conforme clínica | Supabase |
| 11 | DSAR / portal titular | Clínica | FlowMed | Pedidos art. 18 | Pacientes | Direitos titular | Obrigação legal | 5 anos evidência | Supabase |
| 12 | Auditoria plataforma | Clínica | FlowMed | Ações usuários | Staff | Segurança | Legítimo interesse (art. 7º, IX) | 24m+ | Supabase |
| 13 | Site institucional FlowMed | FlowMed | Vercel | Logs, cookies sessão | Visitantes | Marketing produto | Legítimo interesse | Logs técnicos | Vercel |

**Manutenção:** revisar trimestralmente ou a cada nova funcionalidade/subprocessador.
