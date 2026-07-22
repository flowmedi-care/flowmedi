# Roadmap Operacional

Documento **temporário**. Muda toda semana.

Princípios → [`CONSTITUICAO-FLOWMEDI.md`](./CONSTITUICAO-FLOWMEDI.md)  
Como implementar → [`ARQUITETURA-OPERACIONAL.md`](./ARQUITETURA-OPERACIONAL.md)

---

## Diagnóstico

- Mid-migration: Conversa era cérebro; sprint de coerência torna Case autoridade.
- Produto construído ~7.5 · operável sobe quando Constituição cumprida.

---

## Sprint anterior (infraestrutura / scaffolding)

- [x] Estrutura / docs Constituição · Arquitetura · Roadmap
- [x] Workspace shell
- [x] Case board
- [x] Inbox ops + CasePanel links

**Não confundir com Constituição cumprida.**

---

## Nova sprint (coerência) — RFC P0

### Fase A — Fonte Única
- [x] Case autoridade para owner/pending quando vinculado
- [x] `projectConversationFromCase` (Conversation = projeção)
- [x] Mutators → `applyCaseCommands` → projection
- [x] Snapshot Case-first + fail-soft `CaseUnavailable`
- [x] `resolveNextAction` pura (Case + Tasks + Appointment)

### Fase B — Workspace domínio
- [x] Confirmar/realizada via `changeAttendanceStatus` (Agenda)
- [x] `clearCasePendingDecision` + projection
- [x] UI não publica eventos diretamente

### Fase C — Agora view + Zero
- [x] Agora = view de Cases com próxima ação humana (count exact)
- [x] Home secretária sem kanban competindo
- [x] Vocabulary Conversas / Em aberto

### Fase D — Vocab / TTFS / docs
- [x] Demo atendimento sem Meta
- [x] `findCaseIdByEmail`
- [x] ROADMAP + ARQUITETURA atualizados

### Constituição cumprida (aceite)

- [ ] Mesmo owner/pending em CasePanel, Inbox, Workspace
- [ ] Confirmar Workspace altera appointment de verdade
- [ ] Agora contagem correta
- [ ] Patch direto em Conversation **não** altera Case (#8)
- [ ] Snapshot funciona se projection falha + WARNING (#9)
- [ ] Demo &lt;15 min sem Meta

Marque “Constituição cumprida” só após validação manual do aceite acima.

---

## Congelado

Novos módulos · editor workflow · matar WhatsApp · role operador · tabela Agora

---

## Changelog

| Data | Nota |
|------|------|
| 2026-07-21 | Scaffolding Fases 0–4 |
| 2026-07-22 | RFC P0 coerência: Fonte Única + Projection + Workspace domínio |
