# Billing anual — Stripe

Para ativar o ciclo **Anual** em `/precos` e no checkout:

1. No Stripe Dashboard, crie um **Price** recorrente **yearly** para cada plano pago (Essencial, Crescimento/profissional, Operação/estrategico) com ~20% de desconto sobre o mensal.
2. Em `/admin/system/planos`, cole o ID em **Stripe Price ID (anual)** e confirme o texto em **Preço exibido (anual)** (ex.: `R$71/mês`).
3. Rode a migration `supabase/migration-plans-annual-billing-and-pricing-copy.sql` se ainda não rodou.
4. Sem Price anual no plano, o toggle Anual **não aparece** (ou cai no mensal no backend).

Valores de referência (20% off):
- Essencial: R$89/mês → R$71/mês (anual)
- Crescimento: R$347/mês → R$278/mês (anual)
- Operação: R$697/mês → R$558/mês (anual)
