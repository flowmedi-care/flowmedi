# Roadmap de Implementacao Pre-Venda (Flowmedi)

Objetivo: estabilizar o produto, reduzir risco comercial e melhorar percepcao de valor antes de vender o SaaS.

## Ordem recomendada (do mais critico para o menos critico)

## Fase 0 - Diagnostico rapido e baseline (1-2 dias)

1. Levantar tudo que quebra hoje em producao:
   - relatorios sem funcionar
   - realtime do WhatsApp nao atualizando sem F5
   - tickets com mais de 24h ainda como "Ticket aberto"
   - cron disparando muito cedo (5 AM)
2. Definir metricas minimas para validar correcoes:
   - tempo de atualizacao de conversa WhatsApp
   - taxa de falha de envio
   - latencia dashboard principal
3. Criar checklist de regressao basica (admin, profissional, secretario(a)).

> Sem esse baseline, corre-se risco de "melhorar UI" com problemas graves ainda ativos.

---

## Fase 1 - Confiabilidade operacional (prioridade maxima) (3-6 dias)

1. **Corrigir regras de janela WhatsApp (24h)**
   - fechar ticket corretamente quando janela expirar
   - impedir status incorreto em `/dashboard/whatsapp`
2. **Controle de custo por tokens WhatsApp apos 24h**
   - adicionar limite mensal por clinica
   - bloquear envio ao exceder limite
   - exibir aviso claro no painel
3. **Ajustar cron de mensagens automaticas**
   - criar configuracao de horario permitido para envio
   - respeitar fuso horario da clinica
4. **Melhorar realtime do WhatsApp**
   - atualizar conversa ao receber mensagem sem F5
   - fallback de polling curto se socket falhar
5. **Fazer relatorios funcionarem**
   - garantir dados corretos e filtros basicos

> Resultado esperado: sistema confiavel no dia a dia, sem surpresas de custo e sem comportamento incoerente.

---

## Fase 2 - Permissoes, planos e seguranca de produto (4-7 dias)

1. **Bloquear funcoes por plano e configuracoes do admin**
   - implementar guardas no backend (obrigatorio)
   - refletir bloqueio na UI (ocultar/desabilitar)
2. **Ajustar UI de planos conforme admin**
   - exemplo: plano starter sem WhatsApp/email -> remover integracoes da configuracao
3. **Eventos: somente admin altera configuracoes**
4. **Servicos e valores com modo centralizado/descentralizado**
   - centralizado: somente admin cria/edita
   - descentralizado: profissional tambem cria/edita (como hoje)
5. **Integracao pedindo PIN**
   - simplificar fluxo e usar PIN padrao `123456` na API, se aprovado por seguranca interna

> Resultado esperado: evita venda com promessa fora do plano contratado e reduz risco de permissao indevida.

---

## Fase 3 - UX critica e linguagem comercial (3-5 dias)

1. **Padronizar termos da UI**
   - trocar "medico" por "profissional"
   - trocar "secretario(a)" por "secretario(a)" (padrao unico em todo sistema)
2. **Remover emojis da pagina de consulta e profissionalizar visual**
3. **Pacientes: melhorar contexto clinico**
   - ao clicar no contato: mostrar historico de consultas do paciente
   - trocar modal apertado por side panel direita com resumo + ultimas consultas + "Ver tudo"
4. **Campos de pacientes (renomear item da sidebar)**
   - escolher nome mais claro de negocio
5. **Tipos de consulta e procedimentos**
   - incluir opcao de apagar itens criados
   - validar impacto em consultas/agendamentos existentes
6. **Mensagens > historico enviado**
   - adicionar preview
   - adicionar "Ver tudo" (modal/drawer)

> Resultado esperado: melhora imediata da percepcao de valor durante demo/comercial.

---

## Fase 4 - Limpeza de produto e foco (2-3 dias)

1. **Pagina de templates**
   - se esta inutil por causa de "mensagens", descontinuar
   - redirecionar para modulo de mensagens
   - manter compatibilidade de links antigos
2. **Auditoria**
   - mostrar nome/email ao inves de ID cru

> Resultado esperado: navegacao mais objetiva e menos confusao no uso.

---

## Fase 5 - Performance, responsividade e cache (3-6 dias)

1. **Responsivo em telas principais**
   - dashboard, consultas, pacientes, mensagens, whatsapp
2. **Cache**
   - aplicar em leituras pesadas (dashboard/relatorios/listas)
   - invalidacao ao gravar dados criticos
3. **Melhorar dashboard do profissional e da secretaria**
   - cards de produtividade
   - indicadores uteis por perfil
4. **Mostrar desempenho na aba do profissional**

> Resultado esperado: produto mais rapido e pronto para uso real em diferentes dispositivos.

---

## Backlog pos-venda (se precisar cortar escopo)

- refinamentos visuais nao criticos
- micro-ajustes de copy
- melhorias de UX sem impacto operacional direto

---

## Sequencia tecnica sugerida por sprint

### Sprint 1 (Confiabilidade)
- Fase 1 inteira

### Sprint 2 (Permissoes e planos)
- Fase 2 inteira

### Sprint 3 (UX clinica e linguagem)
- Fase 3 inteira

### Sprint 4 (Limpeza + performance)
- Fase 4 e Fase 5

---

## Criterio de "pronto para vender"

1. Sem bug conhecido em envio/recebimento WhatsApp.
2. Regras de plano aplicadas no backend e UI.
3. Relatorios funcionando com dados confiaveis.
4. Fluxos de paciente e consulta claros no desktop e mobile.
5. Dashboard util para admin, profissional e secretario(a).
6. Termos da UI padronizados e linguagem profissional.

---

## Observacao importante

Itens de permissao/plano **devem** ser garantidos no backend primeiro. Ocultar botao na UI sem validar servidor gera brecha e risco comercial/juridico.
