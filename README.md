# Support Intake AI

Sistema web completo para la **opcion D**: clasificador y extractor de documentos de soporte. El usuario sube una captura, ticket, formulario simple o documento corto y la plataforma devuelve un JSON validado con:

- clasificacion del documento
- resumen breve
- datos extraidos
- advertencias
- preguntas de aclaracion
- trazabilidad de tools

## Arquitectura

- `apps/webapp`: Next.js 15 + React + Tailwind. UI para cargar archivos, ver el estado y mostrar el resultado estructurado.
- `apps/api`: FastAPI + Pydantic + OpenAI. Orquesta el flujo agentic, hace tool calling y valida el contrato final.
- `packages/shared`: esquema Zod compartido para tipar la respuesta en el frontend.
- `samples/`: archivos listos para grabar las 3 pruebas del video.

## Flujo del sistema

1. La UI carga un archivo.
2. FastAPI valida formato y tamano.
3. El agente ejecuta tools locales:
   - `extract_document_payload`
   - `normalize_support_fields`
   - `validate_candidate_result`
4. El LLM interpreta la evidencia y propone una respuesta.
5. Una segunda llamada genera el output estructurado.
6. Pydantic valida el contrato final.
7. La UI muestra JSON, warnings, clarifying questions y `tool_trace`.

## Tools utilizadas

- `extract_document_payload`: extrae texto desde PDF/TXT o metadatos desde imagen y detecta senales como fechas, ticket ids, prioridad y categoria.
- `normalize_support_fields`: normaliza prioridad, categoria y fechas para evitar inconsistencias.
- `validate_candidate_result`: verifica faltantes, genera warnings y define si hace falta aclaracion.

## Contrato de salida

La API devuelve exactamente estas llaves de primer nivel:

```json
{
  "status": "success",
  "document_type": "support_document",
  "summary": "string",
  "extracted_data": {},
  "warnings": [],
  "needs_clarification": false,
  "clarifying_questions": [],
  "tool_trace": [
    {
      "tool": "string",
      "reason": "string",
      "success": true
    }
  ]
}
```

## Como correr en local

1. Copia `.env.example` a `.env`.
2. Coloca tu `OPENAI_API_KEY`.
3. Instala dependencias:

```bash
npm install
pip install -r apps/api/requirements.txt
```

4. Levanta frontend y backend juntos:

```bash
npm run dev
```

Servicios:

- web: `http://localhost:3000`
- api: `http://localhost:8000`
- health: `http://localhost:8000/health`

## Variables de entorno

```bash
API_PORT=8000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
UPLOAD_DIR=storage/uploads
MAX_UPLOAD_SIZE_MB=10
ALLOW_MOCK_LLM=false
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

`ALLOW_MOCK_LLM=true` sirve solo para pruebas locales sin API key. Para la entrega conceptual usa el flujo real con LLM.

## Ejemplos de uso

Archivos incluidos en `samples/`:

- `clear-support-ticket.txt`: caso claro, debe terminar en `success`.
- `ambiguous-support-note.txt`: caso ambiguo, debe terminar en `needs_review`.
- `invalid-sample.csv`: caso con error controlado por formato no soportado.

## Despliegue simple con Docker Compose

Flujo pensado para VPS:

1. agregar una Deployment Key al repo
2. clonar el repo
3. copiar `.env.example` a `.env`
4. colocar `DOMAIN`, `LE_EMAIL` y `OPENAI_API_KEY`
5. correr `docker compose up -d --build`

Comandos:

```bash
cp .env.example .env
docker compose up -d --build
```

El proxy Caddy se encarga de:

- servir la web por `443`
- obtener el certificado SSL de Let's Encrypt
- enrutar `/api` hacia FastAPI

Guia paso a paso:

- `deploy/VPS_DEPLOY.md`

## Guion corto para el video

1. Presentate y muestra el link del repo.
2. Ensena la UI.
3. Sube `samples/clear-support-ticket.txt` y muestra `status = success`.
4. Sube `samples/ambiguous-support-note.txt` y muestra `status = needs_review`.
5. Sube `samples/invalid-sample.csv` y muestra `status = error`.
6. Explica en menos de un minuto:
   - modelo usado
   - tools
   - workflow agentic
   - validacion Pydantic
   - como el sistema evita inventar datos
