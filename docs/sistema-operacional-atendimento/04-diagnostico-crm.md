# 4. Diagnóstico CRM — propósito, não tela

**Pergunta-guia:** Em cada superfície, *quem deveria tomar a próxima decisão* depois de olhar isso?

## Matriz propósito × uso × decisão

| Superfície | Rota | Pergunta que responde | Quem usa (papel) | Uso/dia estimado* | Decisão que nasce | Gera trabalho? | Tipo |
|------------|------|----------------------|------------------|-------------------|-------------------|----------------|------|
| Pipeline CRM | `/dashboard/crm/pipeline` | Em que estágio estão leads e comparecimento? Tendências? | Admin (gestão) | Baixo na operação diária | Quase nenhuma na hora; decisões de gestão | Não (leitura + kanban appointment) | **Analytics** |
| Funil (redirect) | `/dashboard/crm/funil` | Idem funis | Admin | — | — | Não | Analytics |
| Centro de Leads | `/dashboard/contatos/leads` | O que faço com este lead no funil comercial? | Secretária / admin | Médio | Mover estágio, qualificar, converter, perdido, nota | Sim, parcial | **Híbrido** |
| Jornada lista | `/dashboard/crm/jornada` | O que deveria acontecer agora com o contato? | Secretária | Médio-alto se adotada | Executar suggested action / filtrar pendentes | Sim | **Operacional** |
| Jornada detalhe | `/dashboard/crm/jornada/[id]` | Onde está na jornada e qual o próximo passo? | Secretária | Por caso | Registrar paciente, status consulta, navegar agenda | Sim | **Operacional** |
| Centro de Jornada | `/dashboard/crm/jornada/centro` | Quem precisa agir? O que os agentes fizeram? | Admin / secretária avançada | Baixo-médio | Abrir contato pendente | Sim (fila) | **Operacional** |
| Captação forms | `/dashboard/crm/captacao` | Como captamos leads por formulário? | Admin | Setup raro | Criar/editar template | Setup | Setup |
| WhatsApp | `/dashboard/whatsapp` | O que o paciente falou / o que respondo? | Secretária | **Muito alto** | Responder, assign, reativar IA | Sim | **Operacional** |
| Agenda | `/dashboard/agenda` (e afins) | Quando e com quem? | Secretária / médico | Alto | Criar/mover status consulta | Sim | **Operacional** |
| Eventos / mensagens | `/dashboard/eventos` etc. | O que disparar ao paciente? | Admin / secretária | Médio | Enviar / configurar | Híbrido | Híbrido |
| Diagnósticos VA | Config → Assistente | A IA está saudável? | Admin | Baixo | Destravar fila / investigar | Ops técnica | Diagnóstico |

\*Estimativa operacional a validar em entrevista; ordem relativa já é evidência do produto.

## Conclusões

1. **Várias telas operacionais** respondem perguntas diferentes (falou? / o que fazer? / quem age? / quando?).
2. **Pipeline CRM** responde pergunta de gestão — classificar como **Analytics**, não posto de trabalho da secretária.
3. A secretária **trabalha** em WhatsApp + Agenda (+ Leads/Jornada se lembrar). Isso é o problema do pilar 5.
4. **Duas “próximas ações”:** `non_registered_pipeline.next_action` vs `suggestedAction` da jornada — decisão ambígua.
5. Centro de Leads está em **Contatos**, não no grupo CRM — fragmentação de mapa mental.

## Quem deveria decidir depois de cada tela (alvo)

| Superfície | Após olhar, quem decide |
|------------|-------------------------|
| Pipeline (analytics) | Admin (estratégia) — **não** consome fila Ops |
| Leads / Jornada / WPP / Agenda operacionais | Convergir: **Responsável Atual** no Centro de Operações |
| Captação | Admin (setup) |

## Recomendação de consolidação

| Manter separado | Fundir na operação diária |
|-----------------|---------------------------|
| Pipeline CRM (funis, KPIs) | WhatsApp + pending journey + handoff + next decision |
| Captação (templates) | Painel Case (CRM + chat + agenda resumida) |
| Diagnósticos VA (eng) | — |

**Entregável:** operacionais → uma superfície (Centro de Operações). Pipeline = analytics.
