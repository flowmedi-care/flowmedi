# Plano de Resposta a Incidentes de Segurança

**Versão:** 2026-07-02 | **Art. 48 LGPD**

## 1. Objetivo

Procedimento para detectar, conter, investigar e comunicar incidentes que afetem dados pessoais tratados pelo FlowMed.

## 2. Classificação

| Nível | Critério | Exemplo |
|-------|----------|---------|
| Crítico | Vazamento dados saúde ou em massa | Bucket público, debug webhook |
| Alto | Acesso não autorizado staff | Conta comprometida admin |
| Médio | Indisponibilidade sem vazamento | Downtime Supabase |
| Baixo | Tentativa bloqueada | Webhook assinatura inválida |

## 3. Fluxo (24–72h)

1. **Detecção** — monitoramento, relato cliente, auditoria
2. **Contenção** — revogar tokens, desabilitar endpoint, rotacionar secrets
3. **Análise** — escopo, titulares afetados, logs Supabase/Vercel
4. **Comunicação** — ANPD (se aplicável), clínicas controladoras, titulares via clínica
5. **Recuperação** — restore backup, correção código
6. **Lições aprendidas** — atualizar ROPA/RIPD

## 4. Contatos

- Encarregado: `LGPD_DPO_EMAIL` (env)
- Infra: responsável técnico FlowMed
- Supabase Support / Vercel conforme incidente

## 5. Registro

Documentar em ticket interno: data, descrição, dados afetados, medidas, comunicações.

## 6. Teste

**Lacuna operacional:** realizar simulação anual de mesa (tabletop).
