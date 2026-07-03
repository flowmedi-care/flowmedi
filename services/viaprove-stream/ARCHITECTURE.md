# ViaProve — reconhecimento da arquitetura batch (referência)

Este documento descreve o contrato do serviço batch existente que **não deve ser alterado**
quando o subsistema `viaprove-stream` for implantado.

## Endpoints batch (porta 8000)

| Método | Rota | Uso no Flowmedi |
|--------|------|-----------------|
| POST | `/v1/transcribe` | `lib/transcribe-api.ts` → `createTranscriptionJob` |
| GET | `/v1/jobs/{job_id}` | `lib/transcribe-api.ts` → `getTranscriptionJob` |

### POST /v1/transcribe

- Auth: `Authorization: Bearer {TRANSCRIBE_API_KEY}`
- Body: `multipart/form-data`
  - `file` — áudio
  - `user_id` — clínica (`clinicId`) ou `clinic-{clinicId}` (WhatsApp)
  - `source` — `whatsapp` | `recording` | `other`
  - `recording_duration_seconds` — opcional (gravações clínicas)

### GET /v1/jobs/{job_id}

- Retorna: `job_id`, `status`, `text`, `duration_seconds`, `processing_time_seconds`, `error_message`
- Status: `queued` | `processing` | `completed` | `failed`

## Consumidores no Flowmedi

1. **WhatsApp** — `lib/virtual-assistant/audio-transcription.ts` (`source=whatsapp`)
2. **Atendimento batch** — `app/api/appointments/[id]/transcribe/route.ts` (`source=recording`)
3. **Fallback streaming** — mesmo endpoint batch se WebSocket falhar

## Novo subsistema stream

Implementação em `services/viaprove-stream/` — porta **8001**, rotas `/v1/stream/*`.

Nenhum arquivo do batch deve ser modificado; deploy como serviço systemd separado.
