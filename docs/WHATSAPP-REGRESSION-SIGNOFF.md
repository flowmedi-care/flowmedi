# WhatsApp Regression Sign-off

## Escopo validado nesta entrega

- Geração de preview para WhatsApp em ticket aberto/fechado.
- Renderização por template Meta com parâmetros posicionais.
- Padronização de linguagem "profissional" em mensagens user-facing.
- Migração de conteúdo para ambientes já em produção.

## Resultado por bloco

| Bloco | Status | Evidência |
| --- | --- | --- |
| Cobertura de mapeamento `event_code -> template` | OK | `docs/WHATSAPP-AUDITORIA-COBERTURA-E-FIDELIDADE.md` |
| Preview ticket fechado (Meta) | OK | `lib/message-processor.ts` + `lib/comunicacao/whatsapp.ts` |
| Fallback de preview (sem template body da Meta) | OK | `lib/whatsapp-meta-templates.ts` |
| Troca "Médico(a)" -> "Profissional" em textos de mensagem | OK | `lib/whatsapp-meta-templates.ts`, migrations e perfil/referral |
| Atualização de conteúdo em bases existentes | OK | `supabase/migration-whatsapp-content-profissional-update.sql` |
| Pacote para novos templates Meta | OK | `docs/WHATSAPP-META-PACOTE-APROVACAO-ADICIONAL.md` |

## Verificações técnicas executadas

- `git diff` revisado nos arquivos alterados.
- Diagnóstico de lint IDE sem erros nos arquivos alterados.
- `npm run lint` não concluído por prompt interativo de setup do Next.js ESLint no ambiente local.

## Pendência operacional (ambiente da clínica)

Executar em homologação/produção:

1. Aplicar migration `supabase/migration-whatsapp-content-profissional-update.sql`.
2. Testar 1 evento de consulta e 1 de formulário em ticket `open` e `closed`.
3. Conferir se o preview passa a refletir o corpo real retornado pela Meta para o template pareado.
4. Se necessário, submeter templates adicionais do pacote para maior fidelidade textual por evento.
