# 📧 Configuração de Email via Google OAuth

O sistema de mensagens usa a integração Google/Gmail. Não precisa de Resend!

---

## ✅ Como Funciona

O sistema usa a função `sendEmail()` de `lib/comunicacao/email.ts` que:
1. Busca as credenciais OAuth do Google da clínica
2. Renova o token automaticamente se expirado
3. Envia email via Gmail API usando a conta conectada

O `redirect_uri` do OAuth usa a origem canônica definida em `NEXT_PUBLIC_APP_URL` (ver `lib/app-origin.ts`). Isso evita erro `redirect_uri_mismatch` quando o usuário acessa o app com ou sem `www`.

---

## 🔧 Setup no Google Cloud Console

### 1. Criar credenciais OAuth

1. Acesse [Google Cloud Console](https://console.cloud.google.com/) → **APIs e serviços** → **Credenciais**.
2. Crie um **ID do cliente OAuth 2.0** do tipo **Aplicativo da Web**.
3. Habilite a **Gmail API** no mesmo projeto.
4. Configure a **Tela de consentimento OAuth** (modo Teste é suficiente para uso interno; adicione os emails que vão conectar).

### 2. URIs de redirecionamento autorizados

Cadastre a URI **exata** que o app envia ao Google. O path é sempre:

```
{NEXT_PUBLIC_APP_URL}/api/integrations/google/callback
```

| Ambiente | Exemplo de URI |
|----------|----------------|
| Produção | `https://flowmed.app/api/integrations/google/callback` |
| Produção (legado) | `https://flowmedi.com.br/api/integrations/google/callback` |
| Local | `http://localhost:3000/api/integrations/google/callback` |
| Preview Vercel | `https://seu-projeto.vercel.app/api/integrations/google/callback` |

**Recomendação:** defina `NEXT_PUBLIC_APP_URL` com o domínio canônico (ex.: `https://flowmed.app`) e cadastre essa URI no Google Console. Mantenha `flowmedi.com.br` durante a transição se já estiver cadastrado.

Se ainda não tiver `NEXT_PUBLIC_APP_URL` em produção, cadastre **ambas** as variantes (`flowmed.app` e `flowmedi.com.br`) até padronizar a variável.

### 3. Variáveis de ambiente (Vercel / `.env.local`)

| Variável | Descrição |
|----------|-----------|
| `NEXT_PUBLIC_APP_URL` | URL canônica do app (sem barra final). Ex.: `https://flowmed.app` |
| `GOOGLE_CLIENT_ID` | Client ID do OAuth 2.0 criado acima |
| `GOOGLE_CLIENT_SECRET` | Client Secret do mesmo client |

**Checklist de verificação:**

1. O `GOOGLE_CLIENT_ID` na Vercel corresponde ao client OAuth onde você cadastrou as URIs de redirect.
2. `GOOGLE_CLIENT_SECRET` é do **mesmo** client (não de outro projeto ou ambiente).
3. `NEXT_PUBLIC_APP_URL` + `/api/integrations/google/callback` está listado em **URIs de redirecionamento autorizados**.
4. Após alterar variáveis na Vercel, faça **redeploy**.

---

## 🔧 Conectar no FlowMedi

### 1. Conectar Conta Google

1. Acesse: **Configurações → Integrações**
2. Clique em **Conectar Google**
3. Autorize o acesso à conta Gmail
4. O sistema salvará as credenciais OAuth automaticamente

### 2. Verificar Conexão

O sistema verifica automaticamente se a integração está conectada antes de enviar emails. Se não estiver conectada, você verá o erro:

> "Integração Google não conectada. Conecte em Configurações → Integrações"

---

## 📝 Como Usar

### Criar Template

1. Acesse: `/dashboard/mensagens/templates`
2. Clique em **Novo Template**
3. Escolha:
   - **Evento:** ex: "Consulta Agendada"
   - **Canal:** Email
   - **Assunto:** ex: "Sua consulta está agendada"
   - **Corpo:** Use variáveis como `{{nome_paciente}}`, `{{data_consulta}}`

### Configurar Evento

1. Acesse: `/dashboard/mensagens`
2. Aba **Email**
3. Ative o evento desejado
4. Escolha modo: **Automático** ou **Manual**
5. Selecione o template criado

### Testar

1. Crie uma consulta na Agenda
2. Se o evento estiver em modo **Automático**:
   - Email será enviado automaticamente via Gmail
3. Se estiver em modo **Manual**:
   - Mensagem ficará pendente em `/dashboard/mensagens/pendentes`
   - Aprove para enviar

---

## ⚠️ Requisitos

- ✅ Conta Google conectada (OAuth)
- ✅ Paciente com email cadastrado
- ✅ Paciente com consentimento LGPD
- ✅ Template criado para o evento
- ✅ Evento ativado e configurado

---

## 🐛 Troubleshooting

### Erro: `redirect_uri_mismatch` (Google OAuth 400)

A URI enviada pelo app não está cadastrada no Google Cloud Console.

1. Na tela de erro do Google, clique em **detalhes do erro** e copie o valor de `redirect_uri`.
2. Adicione essa URI exata em **Credenciais → OAuth 2.0 → URIs de redirecionamento autorizados**.
3. Confirme que `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` na Vercel são do mesmo client.
4. Defina `NEXT_PUBLIC_APP_URL` com o domínio canônico e redeploy.
5. Aguarde 1–5 minutos e tente novamente.

**Descobrir a URI via DevTools:** Network → resposta de `/api/integrations/google/auth` → parâmetro `redirect_uri` na `authUrl`.

### Erro: "Integração Google não conectada"
- Vá em **Configurações → Integrações**
- Conecte sua conta Google
- Verifique se o status está como "Conectado"

### Erro: "Token expirado"
- O sistema renova automaticamente
- Se persistir, desconecte e reconecte a integração

### Email não está sendo enviado
- Verifique se a integração está conectada
- Verifique se o paciente tem email cadastrado
- Verifique se o paciente tem consentimento LGPD
- Verifique os logs do console para erros específicos

---

## 📚 Arquivos Relacionados

- `lib/app-origin.ts` - Origem canônica e redirect URI do OAuth Google
- `lib/comunicacao/email.ts` - Função de envio via Gmail API
- `lib/message-processor.ts` - Processador de eventos
- `app/api/integrations/google/` - Rotas de OAuth

---

**Status:** ✅ Integrado com Google OAuth existente
