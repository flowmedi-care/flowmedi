# Roadmap Operacional

Documento **temporário**. Muda toda semana.

Princípios → [`CONSTITUICAO-FLOWMEDI.md`](./CONSTITUICAO-FLOWMEDI.md)  
Como implementar → [`ARQUITETURA-OPERACIONAL.md`](./ARQUITETURA-OPERACIONAL.md)

---

## Diagnóstico (semana atual)

- **Mid-migration:** UX ainda usa conversa como cérebro; backend já caminha para Atendimento.
- **Produto construído:** ~7–8/10 · **Produto operável:** ~5–5.5/10 (subindo com esta sprint).
- Próximo salto: fazer o existente obedecer à Constituição — **não** adicionar módulo.

---

## Fase 0 — Documentos

- [x] `CONSTITUICAO-FLOWMEDI.md`
- [x] `ARQUITETURA-OPERACIONAL.md`
- [x] `ROADMAP-OPERACIONAL.md` (este arquivo)

---

## Fase 1 (P0) — Verdade operacional

Leis 1–3.

- [x] Um Responsável Atual com nome na UI (`ownerLabel` + enrichment)
- [x] Próxima ação destacada (`resolveNextAction` + Workspace/board)
- [x] Motivo de ownership visível no CasePanel
- [x] Decisão apresentada como do Atendimento nas superfícies ops

---

## Fase 2 (P0) — Workspace + Princípio Zero

Leis 6, Zero.

- [x] Workspace executável: próxima ação, conversa deep-link, agenda, financeiro
- [x] Painéis só declarados se renderizados
- [x] CasePanel → Workspace / Agenda (sem `/dashboard/pipeline` 404)
- [x] Jornada `?phone=` / `?caseId=` → Workspace
- [x] Redirect `/dashboard/pipeline` → Pendências

---

## Fase 3 (P1) — Home, onboarding, IA, vocabulário

- [x] Home “Agora” (admin + secretária) prioriza pendências
- [x] Checklist pós-onboarding + links TTFS
- [x] Motivo de handoff/reativação em linguagem humana (CasePanel)
- [x] Vocabulary Lock parcial na nav/topbar (Conversas, Pendências, Fila de envio)

---

## Fase 4 (P2) — Estados

- [x] `app/dashboard/error.tsx`
- [x] Empty state de Pendências no board

---

## Congelado até estabilizar mid-migration

- Novos módulos / dashboards sem decisão
- Editor visual de workflow
- Segundo kanban / matar WhatsApp
- Role “operador” novo

---

## Próxima semana (sugerido)

- [ ] Enriquecer sync Case←→Conversa até pending_decision único na prática
- [ ] Demo operacional sem Meta (simular evento → pendência)
- [ ] Renomear filas WhatsApp Decidir/IA para vocabulário oficial
- [ ] Instruções Agenda + WhatsApp (tirar coming_soon)

---

## Changelog do roadmap

| Data | Nota |
|------|------|
| 2026-07-21 | Criação + Fases 0–4 implementadas no código |
