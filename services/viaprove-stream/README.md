# ViaProve Stream Service — subsistema de transcrição em tempo real
#
# Este serviço roda SEPARADO do batch (porta 8000) para não afetar WhatsApp.
# Contrato batch preservado: POST /v1/transcribe, GET /v1/jobs/{id}

## Arquitetura batch existente (NÃO MODIFICAR)

O serviço batch na porta 8000 atende:
- `POST /v1/transcribe` — multipart: file, user_id, source, recording_duration_seconds
- `GET /v1/jobs/{job_id}` — status do job assíncrono
- Auth: `Authorization: Bearer {TRANSCRIBE_API_KEY}`
- Sources: `whatsapp` (user_id=clinic-{uuid}), `recording` (user_id=clinic uuid)

## Novo subsistema stream (porta 8001)

- `POST /v1/stream/sessions` — cria sessão
- `WS /v1/stream/ws?token=JWT` — streaming áudio ↔ texto
- `POST /v1/stream/sessions/{id}/chunks` — fallback HTTP
- `GET /v1/stream/sessions/{id}` — artefatos
- `DELETE /v1/stream/sessions/{id}` — cleanup
- `GET /v1/stream/health` — health check

## Deploy

```bash
cd services/viaprove-stream
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## systemd

Ver `systemd/viaprove-stream.service` e configure nginx:

```nginx
location /v1/stream/ {
    proxy_pass http://127.0.0.1:8001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```

## Rollback

```bash
systemctl stop viaprove-stream
# batch continua em porta 8000
```

## Variáveis

Ver `.env.example`
