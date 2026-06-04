# Fluxo operacional v2.0 — status de implementação

Documento de acompanhamento das correções alinhadas ao contrato v2.0 (decisões D1–D8 e lacunas L-01–L-15).

Complementa [`FLUXO-OPERACIONAL-COMPLETO.md`](FLUXO-OPERACIONAL-COMPLETO.md) e [`FINANCEIRO-MAPA-E-LACUNAS.md`](FINANCEIRO-MAPA-E-LACUNAS.md).

**Última atualização:** 2026-06-04 (verificação + correções)

---

## 1. Verificação — 8 testes (pós-correção)

| # | Teste | Resultado | Notas |
|---|-------|-----------|-------|
| 1 | Taxa cartão → despesa MDR (D4) | ✅ | `recordPaymentAccounting` + `resolvePaymentFee` com fallback fee=0 e `console.warn` |
| 2 | Cancelamento estorno reduz caixa (D5) | ✅ | `recordRefundAccounting` origin `refund`; `refunded_at` excluído do dashboard; estoque não reverte consumo |
| 3 | Plano 10 sessões rateio + caixa zero (D3) | ✅ | `session_revenue_amount`, `plan_prepaid`, alias `a_vista` → antecipado |
| 4 | Cancel sessão plano → `sessions_used` (L-14) | ✅ | `recalcTreatmentPlanSessionsUsed` em `cancelComanda` |
| 5 | Estoque FEFO (D6) | ✅ | `expiry_date ASC`, `appointment_stock_lots` |
| 6 | Dashboard Receita Faturada vs Caixa (D1) | ✅ | Exclui `cancelada`, `plan_prepaid`, `refunded_at`, `credito_interno` |
| 7 | Check-in antecipado emite cupom (L-11) | ✅ | `earlyEmit` em `emitComanda` |
| 8 | Crédito paciente no pagamento (N-02) | ✅ | `createPatientCredit` no cancel; UI checkbox em `comanda-payment-dialog` |

---

## 2. Histórico — entrega anterior (sessão base)

| Área | O que foi feito | Arquivos |
|------|-----------------|----------|
| Migration base | `payment_policy`, bancos, MDR, recibos, planos, lotes | `supabase/migration-operational-flow-extensions.sql` |
| UI operacional | Aba Operacional, `beginAppointmentCare`, fila → consulta | `consulta-tabs-client.tsx`, `atendimento-list-client.tsx` |
| Check-in | Política antecipado / no dia / pós-atendimento | `check-in-payment-policy.tsx` |
| Caixa (parcial) | Contas bancárias, taxas, recibo HTML | `bank-account-actions.ts`, `receipt-actions.ts`, `comanda-payment-dialog.tsx` |
| Planos (CRUD) | Lista e criação de planos | `treatment-plan-actions.ts`, `/dashboard/planos-tratamento` |
| Lotes (CRUD) | Cadastro manual de lotes | `/dashboard/estoque/lotes` |

---

## 2. Correções desta entrega (v2 gaps)

### Migration

- **`supabase/migration-operational-flow-v2-gaps.sql`**
  - `comandas.cancellation_type`, `treatment_plan_id`, `session_revenue_amount`
  - `patient_credits`
  - `financial_entries.bank_account_id`, categoria `taxas_bancarias`
  - `patient_payments.plan_prepaid`
  - `receipts.comanda_id`, `pdf_url`, `voided_at`
  - `stock_lots.quantity_committed`, `stock_movements.expired_at_consumption`
  - `appointment_stock_lots` (ponte FEFO)
  - Alertas em `product_field_definitions`

### Fase 1 — Caixa confiável

| Item | Implementação |
|------|----------------|
| D4 contabilidade MDR | `lib/financeiro/payment-accounting.ts` — receita bruta + despesa `taxas_bancarias` |
| Pagamento | `registerComandaPayment` e `emitComanda` usam helper; médico pode pagar |
| Conta obrigatória | Erro se `bank_account_id` ausente |
| Cancelamento | `cancelComanda` com estorno / crédito / perda; `patient-credit-actions.ts` |
| Recibos | Geração em todos os paths de pagamento; `voidReceiptsForPayment` no estorno |
| Política pagamento | `emitComanda` permite cupom antes do clínico se `antecipado` ou `no_dia` |
| Labels | UI financeiro/paciente: **Cupom** / **Recibo** |
| Dashboard caixa | `entradasCaixa` usa `gross_amount`; exclui `plan_prepaid` |

### Fase 2 — Planos

| Item | Implementação |
|------|----------------|
| Rateio 1/N | `emitComanda` lê `treatment_plan_id`, define `session_revenue_amount` |
| Sessão pré-paga | `plan_prepaid` em `patient_payments` quando plano antecipado quitado |
| Agendar sessões | `generatePlanAppointments` + UI em planos-tratamento |
| `sessions_used` | `recalcTreatmentPlanSessionsUsed` no emit/cancel comanda e cancel consulta |
| Pagamento plano | `registerPlanPayment` |

### Fase 2 — Estoque

| Item | Implementação |
|------|----------------|
| FEFO | `commitLotAllocations` / `consumeLotAllocations` / `releaseLotAllocations` em `lib/clinic-operations.ts` |
| Alertas validade | `listExpiringStockLots` + card em `/dashboard/estoque` (alertar, não bloquear) |
| Campos produto | `listProductFieldValues`, `upsertProductFieldValue` |

---

## 3. Matriz lacunas L-01–L-15

| ID | Descrição | Status |
|----|-----------|--------|
| L-01 | `bank_accounts` | **Fechado** |
| L-02 | `payment_fee_rules` | **Fechado** (fallback fee=0 se regra ausente) |
| L-03 | Rateio receita plano | **Fechado** |
| L-04 | Recibos | **Fechado** — PDF Storage + HTML fallback |
| L-05 | `cancellation_type` | **Fechado** |
| L-06 | `patient_credits` | **Fechado** (criação + uso no pagamento) |
| L-07 | `category` despesa | **Fechado** incl. `taxas_bancarias` |
| L-08 | `bank_account_id` em FE | **Fechado** |
| L-09 | Campos produto | **Parcial** — API valores; UI ficha produto pendente |
| L-10 | FEFO lotes | **Fechado** (produtos sem lote continuam agregados) |
| L-11 | `payment_policy` operacional | **Fechado** |
| L-12 | MDR → despesa automática | **Fechado** (D4) |
| L-13 | Sessão pré-paga plano | **Fechado** (`plan_prepaid`) |
| L-14 | `sessions_used` cancel | **Fechado** |
| L-15 | Competência exclui canceladas | **Já estava fechado** |

---

## 4. Decisões D1–D8 no código

| # | Decisão | Reflexo no código |
|---|---------|-------------------|
| D1 | Receita Faturada + Entradas Caixa | `financeiro-overview-client.tsx`, `getDashboardMetrics` |
| D2 | Competência na emissão cupom | `comanda-rules.ts`, `issued_at` em `emitComanda` |
| D3 | Rateio 1/N por sessão | `emitComanda` + `session_revenue_amount` |
| D4 | Taxa = despesa separada | `payment-accounting.ts` |
| D5 | Cancel: estorno/crédito/perda | `cancelComanda` + modal |
| D6 | Alertar lotes, não bloquear | alertas estoque + `expired_at_consumption` |
| D7 | Médico pode pagar | `registerComandaPayment` |
| D8 | Labels Cupom/Recibo | UI financeiro, paciente, fila |

---

## 5. Novas lacunas (N-01–N-08)

| ID | Lacuna | Solução proposta |
|----|--------|------------------|
| N-01 | Recorrência automática N slots | **Fechado** — wizard em `/dashboard/planos-tratamento` |
| N-02 | Usar `patient_credits` no pagamento | **Fechado** — `comanda-payment-dialog` |
| N-03 | CMV automático DRE | Pendente — Fase 5 |
| N-04 | PDF recibo no Supabase Storage | **Fechado** — `lib/financeiro/receipt-pdf.tsx` |
| N-05 | Conciliação bancária por conta | Pendente |
| N-06 | Recibo consolidado vs por pagamento | Pendente |
| N-07 | Backfill `gross_amount` histórico | **Fechado** — `migration-v2-corrections-20260604.sql` |
| N-08 | Cupom antecipado sem CMV na emissão | OK por D2; CMV na realização clínica |

---

## 6. Migrations a aplicar (ordem)

1. `migration-comanda-clinical-split.sql` (se ainda não)
2. `migration-operational-flow-extensions.sql`
3. **`migration-operational-flow-v2-gaps.sql`**
4. **`migration-v2-corrections-20260604.sql`**

**Storage:** criar bucket público `receipts` no Supabase.

---

## 7. Smoke tests sugeridos

1. Cartão 2,5%: caixa +R$ 1.000; despesa taxas +R$ 25; receita faturada inalterada.
2. Cancelar cupom paga → estorno (admin) reduz caixa; crédito aparece no paciente.
3. Plano 10× R$ 3.000 antecipado: sessão 3 emite cupom R$ 300, caixa zero, receita +R$ 300.
4. Produto com lote: committed FEFO no agendar; consumo baixa o mesmo lote.
5. Check-in antecipado: cupom + pagamento antes do médico finalizar clínico.

---

## 8. Arquivos principais (esta entrega)

| Arquivo | Função |
|---------|--------|
| `supabase/migration-operational-flow-v2-gaps.sql` | Schema v2 gaps |
| `lib/financeiro/payment-accounting.ts` | D4 caixa + MDR |
| `app/dashboard/agenda/encounter-actions.ts` | emit/cancel/pay |
| `app/dashboard/financeiro/patient-credit-actions.ts` | Créditos paciente |
| `app/dashboard/financeiro/receipt-actions.ts` | Recibos + void |
| `app/dashboard/agenda/treatment-plan-actions.ts` | Planos + rateio |
| `lib/clinic-operations.ts` | FEFO lotes |
| `app/dashboard/financeiro/components/cancel-comanda-dialog.tsx` | UI cancelamento |
