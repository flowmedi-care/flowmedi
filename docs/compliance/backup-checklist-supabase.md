# Checklist — Backups Supabase (produção)

**Art. 46 LGPD** — disponibilidade e recuperação

Execute no **Supabase Dashboard** do projeto de produção e arquive evidências (screenshot/export).

## Diário

- [ ] Backups automáticos habilitados (plano Pro+)
- [ ] PITR (Point-in-Time Recovery) ativo, se disponível no plano
- [ ] Região do projeto documentada (preferência: São Paulo / proximidade BR)

## Mensal

- [ ] Teste de restore em projeto de staging (amostra de tabela `patients` anonimizada)
- [ ] RTO/RPO definidos e comunicados à equipe
- [ ] Revisão retenção de logs Supabase

## Anual

- [ ] Simulação de desastre completo
- [ ] Atualização deste checklist na ROPA

## Lacunas no repositório

O código **não** configura backups; dependem 100% do painel Supabase. Sem evidência de dashboard = item **não conforme** para auditoria externa.
