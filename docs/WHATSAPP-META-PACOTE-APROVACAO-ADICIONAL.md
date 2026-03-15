# Pacote de templates adicionais para Meta (quando precisar maior fidelidade)

## Quando usar este pacote

Use este pacote se a clínica quiser que mensagens de WhatsApp fora da janela de 24h fiquem com redação mais específica por evento, sem depender de texto genérico.

## Convenções

- Categoria recomendada: `UTILITY`
- Idioma: `pt_BR`
- Formato: posicional
- Variáveis: manter objetivas e com exemplos reais na submissão

## Sugestão de templates adicionais

### 1) `flowmedi_consulta_com_formulario`

**Body**
```
Olá {{1}},

Confirmamos o agendamento da sua consulta para {{2}} com o profissional {{3}}.

Para preencher antes da consulta, acesse:
{{4}}

Qualquer dúvida, estamos à disposição.

{{5}}
```

### 2) `flowmedi_consulta_sem_formulario`

**Body**
```
Olá {{1}},

Confirmamos o agendamento da sua consulta para {{2}} com o profissional {{3}}.

Qualquer dúvida, estamos à disposição.

{{4}}
```

### 3) `flowmedi_consulta_remarcada`

**Body**
```
Olá {{1}},

Informamos que sua consulta foi remarcada para {{2}} com o profissional {{3}}.

Qualquer dúvida, estamos à disposição.

{{4}}
```

### 4) `flowmedi_lembrete_consulta`

**Body**
```
Olá {{1}},

Lembramos que sua consulta com o profissional {{2}} está agendada para {{3}}.

{{4}}
```

### 5) `flowmedi_formulario_link`

**Body**
```
Olá {{1}},

Precisamos que você preencha o formulário antes da sua consulta.

{{2}}

Obrigado pelo apoio.

{{3}}
```

## Exemplo de parâmetros por template

- `{{1}}`: nome do paciente
- `{{2}}`: data/hora da consulta (quando aplicável)
- `{{3}}`: nome do profissional (quando aplicável)
- `{{4}}`: link do formulário ou frase curta de apoio
- `{{5}}`: nome da clínica

## Estratégia recomendada de rollout

1. Submeter 1 template novo por vez no Meta e aguardar aprovação.
2. Sincronizar status no painel (`Mensagens > Templates`).
3. Parear template aprovado em `clinic_whatsapp_meta_templates`.
4. Validar preview + envio em ticket fechado antes de ampliar uso.
