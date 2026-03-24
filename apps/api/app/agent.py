import base64
import json
import re
from typing import Any

from openai import OpenAI

from .config import get_settings
from .models import AnalysisResponse, DocumentTypeEnum, StatusEnum, ToolTraceItem
from .tools import (
    DocumentBundle,
    build_tool_specs,
    extract_document_payload,
    normalize_support_fields,
    run_tool,
    validate_candidate_result
)


AGENT_SYSTEM_PROMPT = """
Eres un analista de intake para soporte tecnico y operativo.
Tu trabajo es analizar tickets, capturas o formularios simples.
Reglas:
- Debes usar herramientas antes de concluir.
- Usa primero extract_document_payload.
- Antes de terminar, usa normalize_support_fields y validate_candidate_result.
- No inventes datos ausentes.
- Si faltan campos clave, marca needs_review y prepara preguntas de aclaracion.
- Si el archivo no parece de soporte, usa document_type = other o unknown.
- Tu respuesta final en esta fase debe ser un resumen operativo breve en espanol.
"""

STRUCTURED_SYSTEM_PROMPT = """
Convierte la evidencia del agente en un JSON final validable.
Debes devolver exactamente estas llaves de primer nivel:
status, document_type, summary, extracted_data, warnings, needs_clarification, clarifying_questions, tool_trace.
Reglas:
- status solo puede ser success, needs_review o error.
- document_type solo puede ser lab_result, academic_document, medical_document, support_document, other o unknown.
- Si needs_clarification es true, incluye al menos 2 preguntas.
- Si needs_clarification es false, clarifying_questions debe ser [].
- No inventes datos; usa null o listas vacias cuando falte informacion.
- El caso principal esperado es support_document.
"""


def analyze_document(bundle: DocumentBundle) -> AnalysisResponse:
    settings = get_settings()
    if not settings.openai_api_key:
        if settings.allow_mock_llm:
            return analyze_document_mock(bundle)

        return AnalysisResponse.model_validate(
            {
                "status": "error",
                "document_type": "unknown",
                "summary": "No se encontro OPENAI_API_KEY, por lo que el flujo con LLM no pudo ejecutarse.",
                "extracted_data": {},
                "warnings": ["Configura OPENAI_API_KEY para habilitar el analisis real con IA."],
                "needs_clarification": False,
                "clarifying_questions": [],
                "tool_trace": [
                    {
                        "tool": "llm_orchestrator",
                        "reason": "Intentar iniciar el workflow agentic con el modelo configurado.",
                        "success": False
                    }
                ]
            }
        )

    client = OpenAI(api_key=settings.openai_api_key)
    tool_specs = build_tool_specs()
    messages = build_initial_messages(bundle)
    tool_trace: list[ToolTraceItem] = []
    tool_results: list[dict[str, Any]] = []
    assistant_summary = ""

    for _ in range(6):
        completion = client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            tools=tool_specs,
            tool_choice="auto",
            temperature=0.2
        )
        message = completion.choices[0].message
        messages.append(serialize_assistant_message(message))

        if not message.tool_calls:
            assistant_summary = message.content or ""
            break

        for tool_call in message.tool_calls:
            tool_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments or "{}")
            result = run_tool(tool_name, arguments, bundle)
            tool_results.append({"tool": tool_name, "result": result})
            tool_trace.append(
                ToolTraceItem(
                    tool=tool_name,
                    reason=arguments.get("reason", "Herramienta invocada durante el workflow agentic."),
                    success="tool_error" not in result
                )
            )
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False)
                }
            )

    if not assistant_summary:
        assistant_summary = "El agente completo el uso de herramientas, pero no emitio un resumen final."

    structured_completion = client.beta.chat.completions.parse(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": STRUCTURED_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "file": {
                            "filename": bundle.filename,
                            "mime_type": bundle.guessed_mime_type,
                            "size_bytes": bundle.size_bytes
                        },
                        "assistant_summary": assistant_summary,
                        "tool_results": tool_results,
                        "tool_trace": [item.model_dump() for item in tool_trace]
                    },
                    ensure_ascii=False
                )
            }
        ],
        response_format=AnalysisResponse,
        temperature=0.1
    )

    parsed = structured_completion.choices[0].message.parsed
    if parsed is None:
        raise RuntimeError("El modelo no devolvio una salida estructurada valida.")

    return enforce_contract(parsed, tool_trace)


def analyze_document_mock(bundle: DocumentBundle) -> AnalysisResponse:
    tool_trace: list[ToolTraceItem] = []

    extracted = extract_document_payload(bundle)
    tool_trace.append(
        ToolTraceItem(
            tool="extract_document_payload",
            reason="Obtener texto base, metadatos y senales del archivo antes de clasificarlo.",
            success=True
        )
    )

    candidate = build_mock_candidate(bundle, extracted)

    normalized = normalize_support_fields(candidate)
    tool_trace.append(
        ToolTraceItem(
            tool="normalize_support_fields",
            reason="Homogeneizar prioridad, categoria y fecha detectadas por el flujo heuristico.",
            success=True
        )
    )
    candidate = normalized["normalized_candidate"]

    validation = validate_candidate_result(candidate)
    tool_trace.append(
        ToolTraceItem(
            tool="validate_candidate_result",
            reason="Revisar faltantes, advertencias y necesidad de aclaraciones antes de responder.",
            success=True
        )
    )

    return AnalysisResponse.model_validate(
        {
            "status": validation["status_suggestion"],
            "document_type": candidate.get("document_type", "support_document"),
            "summary": candidate.get(
                "summary",
                "Analisis heuristico ejecutado en modo mock para desarrollo local."
            ),
            "extracted_data": {
                **candidate,
                "missing_fields": validation["missing_fields"]
            },
            "warnings": validation["warnings"],
            "needs_clarification": validation["needs_clarification"],
            "clarifying_questions": ensure_two_questions(validation["clarifying_questions"]),
            "tool_trace": [item.model_dump() for item in tool_trace]
        }
    )


def build_initial_messages(bundle: DocumentBundle) -> list[dict[str, Any]]:
    user_content: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": (
                "Analiza este archivo para el sistema de soporte. "
                f"Nombre: {bundle.filename}. "
                f"MIME: {bundle.guessed_mime_type}. "
                "Necesito clasificacion, resumen, datos clave, advertencias y preguntas si faltan datos."
            )
        }
    ]

    if bundle.is_image:
        user_content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{bundle.guessed_mime_type};base64,{base64.b64encode(bundle.raw_bytes).decode('utf-8')}"
                }
            }
        )

    return [
        {"role": "system", "content": AGENT_SYSTEM_PROMPT},
        {"role": "user", "content": user_content}
    ]


def build_mock_candidate(bundle: DocumentBundle, extracted: dict[str, Any]) -> dict[str, Any]:
    text = str(extracted.get("text_excerpt") or "")
    lowered = text.lower()
    category = (extracted.get("category_candidates") or ["form"])[0] if text else "form"
    priority = (extracted.get("priority_candidates") or ["medium"])[0]
    ticket_candidates = extracted.get("ticket_candidates") or []
    date_candidates = extracted.get("date_candidates") or []
    reporter_match = re.search(
        r"(?:usuario|reportado por|reporta|nombre)\s*[:\-]\s*([^\n]+)",
        text,
        flags=re.IGNORECASE
    )
    product_match = re.search(
        r"(?:sistema|portal|producto|modulo)\s*[:\-]\s*([^\n]+)",
        text,
        flags=re.IGNORECASE
    )

    if "pantalla" in lowered or "error" in lowered or "bug" in lowered:
        category = "bug"
        priority = "high" if "urgente" in lowered or "urgent" in lowered else priority
    if "password" in lowered or "login" in lowered:
        category = "access"
    if "caido" in lowered or "sin servicio" in lowered:
        category = "outage"
        priority = "urgent"

    needs_other = not text and bundle.extension not in {".png", ".jpg", ".jpeg", ".webp"}
    document_type = "other" if needs_other else "support_document"

    return {
        "document_type": document_type,
        "classification": "support_intake",
        "category": category,
        "priority": priority,
        "suggested_action": suggest_action(category, priority),
        "alert_level": priority,
        "ticket_id": ticket_candidates[0] if ticket_candidates else None,
        "reporter_name": reporter_match.group(1).strip() if reporter_match else None,
        "organization": None,
        "incident_date": date_candidates[0] if date_candidates else None,
        "contact_channel": detect_channel(lowered),
        "product_area": product_match.group(1).strip() if product_match else detect_product_area(lowered),
        "issue_summary": text[:180] if text else "La imagen requiere inspeccion manual del contenido visual.",
        "evidence_found": extracted.get("category_candidates") or [],
        "summary": "Documento de soporte clasificado y preparado para triage."
    }


def suggest_action(category: str | None, priority: str | None) -> str:
    if category == "outage":
        return "Escalar al equipo de infraestructura y abrir incidente."
    if category == "access":
        return "Validar identidad del usuario y revisar acceso o credenciales."
    if category == "billing":
        return "Revisar cobros, comprobantes y estado del pago."
    if category == "bug":
        return "Reproducir el error, adjuntar evidencia y escalar a soporte tecnico."
    if priority == "urgent":
        return "Hacer triage inmediato y escalar al equipo de guardia."
    return "Registrar el caso y solicitar mas contexto si es necesario."


def detect_channel(text: str) -> str | None:
    if "whatsapp" in text:
        return "whatsapp"
    if "correo" in text or "email" in text:
        return "email"
    if "formulario" in text or "form" in text:
        return "web_form"
    return None


def detect_product_area(text: str) -> str | None:
    if "erp" in text:
        return "erp"
    if "portal" in text:
        return "portal"
    if "app" in text:
        return "mobile_app"
    return None


def ensure_two_questions(questions: list[str]) -> list[str]:
    fallback = [
        "¿Quien debe atender este caso o a que usuario afecta exactamente?",
        "¿Que evidencia adicional o contexto operativo hace falta para cerrar el analisis?"
    ]
    combined = [question for question in questions if question]
    for question in fallback:
        if len(combined) >= 2:
            break
        if question not in combined:
            combined.append(question)
    return combined[:3]


def enforce_contract(result: AnalysisResponse, tool_trace: list[ToolTraceItem]) -> AnalysisResponse:
    data = result.model_dump()
    data["tool_trace"] = [item.model_dump() for item in tool_trace]

    valid_document_types = {
        DocumentTypeEnum.LAB_RESULT.value,
        DocumentTypeEnum.ACADEMIC_DOCUMENT.value,
        DocumentTypeEnum.MEDICAL_DOCUMENT.value,
        DocumentTypeEnum.SUPPORT_DOCUMENT.value,
        DocumentTypeEnum.OTHER.value,
        DocumentTypeEnum.UNKNOWN.value
    }

    if data["document_type"] not in valid_document_types:
        data["document_type"] = DocumentTypeEnum.UNKNOWN.value
    if data["status"] == StatusEnum.ERROR.value:
        data["document_type"] = DocumentTypeEnum.UNKNOWN.value

    if data["needs_clarification"]:
        data["clarifying_questions"] = ensure_two_questions(data["clarifying_questions"])
        if data["status"] == StatusEnum.SUCCESS.value:
            data["status"] = StatusEnum.NEEDS_REVIEW.value
    else:
        data["clarifying_questions"] = []

    extracted = data.get("extracted_data") or {}
    extracted.setdefault("evidence_found", [])
    extracted.setdefault("missing_fields", [])
    data["extracted_data"] = extracted

    return AnalysisResponse.model_validate(data)


def serialize_assistant_message(message: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"role": "assistant"}

    if message.content is not None:
        payload["content"] = message.content
    if message.tool_calls:
        payload["tool_calls"] = [
            {
                "id": tool_call.id,
                "type": tool_call.type,
                "function": {
                    "name": tool_call.function.name,
                    "arguments": tool_call.function.arguments
                }
            }
            for tool_call in message.tool_calls
        ]

    return payload
