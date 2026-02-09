# E-mail no Supabase (rate limit e "Error sending confirmation email")

## "Error sending confirmation email" (Resend / SMTP customizado)

Depois de configurar o Resend como SMTP no Supabase, esse erro quase sempre é:

- **Remetente inválido:** o **Sender email** no Supabase precisa ser um endereço de um **domínio verificado** no Resend (Resend → Domains → adicionar e verificar o domínio via DNS). Ex.: depois de verificar `minhaclinica.com`, use `noreply@minhaclinica.com` como Sender email.
- **Senha do SMTP:** use a **API Key** do Resend (Resend → API Keys), não a senha da sua conta.
- **Configuração:** Host `smtp.resend.com`, Port `465`, Username `resend`, Password = API Key.

Se ainda não tiver domínio verificado, verifique um domínio no Resend ou use temporariamente **Confirm email** desligado (veja mais abaixo) só para desenvolvimento.

---

## "Email rate limit exceeded"

Esse erro vem do **Supabase Auth**: o projeto atingiu o limite de envio de e-mails em um período (confirmação de cadastro, "esqueci minha senha", etc.).

## O que fazer na hora

1. **Aguardar** — o limite costuma resetar em alguns minutos (plano gratuito é mais restritivo).
2. **Evitar novos disparos** — não clique várias vezes em "Criar conta" ou "Esqueci minha senha"; cada clique gera um novo e-mail.

## Solução permanente: usar seu próprio SMTP

Quando você usa **SMTP customizado**, o Supabase deixa de usar o servidor de e-mail deles e passa a usar o seu. O limite passa a ser do seu provedor (Resend, SendGrid, etc.), que costuma ser bem maior.

### No Supabase Dashboard

1. **Project Settings** (ícone de engrenagem) → **Authentication** → **SMTP Settings**.
2. Ative **Custom SMTP** e preencha:
   - **Sender email:** o e-mail que aparece como remetente (ex.: `noreply@seudominio.com`).
   - **Sender name:** ex. `FlowMedi`.
   - **Host / Port / User / Password:** dados fornecidos pelo seu provedor de e-mail.

### Exemplo com Resend (e se der "Error sending confirmation email")

O erro **"Error sending confirmation email"** depois de configurar o Resend costuma ser **remetente não permitido**: o Resend só envia se o **Sender email** for de um domínio que você **verificou** no Resend, ou um endereço de teste que eles liberam.

**Configuração exata no Supabase (SMTP Settings):**

| Campo         | Valor              |
|---------------|--------------------|
| **Sender email** | Use um e-mail de um domínio **verificado** no Resend (ex.: `noreply@seudominio.com` depois de verificar `seudominio.com`). Para teste, veja abaixo. |
| **Sender name**  | `FlowMedi` (ou o que quiser) |
| **Host**         | `smtp.resend.com`   |
| **Port**         | `465` (recomendado) ou `587` |
| **Username**     | `resend`            |
| **Password**     | Sua **API Key** do Resend (em [resend.com/api-keys](https://resend.com/api-keys)) |

**Por que falha na maioria das vezes:**

1. **Sender email sem domínio verificado** — No Resend, vá em **Domains** e adicione/verifique seu domínio (DNS). O e-mail remetente no Supabase tem que ser desse domínio (ex.: `noreply@meudominio.com`).
2. **Senha errada** — A senha do SMTP é a **API Key** do Resend, não a senha da sua conta.
3. **Porta** — Teste com **465** (SSL). Se o Supabase não aceitar, use **587**.

**Para testar sem ter domínio próprio:** no Resend, verifique se existe um remetente de teste (ex.: domínio `resend.dev`). Se a sua conta permitir enviar de `onboarding@resend.dev`, use esse endereço como **Sender email** no Supabase só para desenvolvimento. Caso contrário, você precisa **verificar um domínio** no Resend e usar um e-mail desse domínio como remetente.

### Exemplo com SendGrid

- Em [sendgrid.com](https://sendgrid.com), crie um remetente verificado e uma API Key.
- Use o SMTP do SendGrid (host, porta, usuário e senha) nas **SMTP Settings** do Supabase.

Depois de salvar, os e-mails de autenticação (confirmação, recuperação de senha) passam a sair pelo seu SMTP e o erro "email rate limit exceeded" do Supabase deixa de aparecer para esse limite interno deles.

## Desativar confirmação de e-mail (só para desenvolvimento)

Em **Authentication** → **Providers** → **Email**, você pode desligar **Confirm email**. Assim o Supabase não envia e-mail de confirmação e o usuário entra logo após se cadastrar — útil só em ambiente de teste, não em produção.
