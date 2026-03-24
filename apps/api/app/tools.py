import mimetypes
import re
from dataclasses import dataclass, field
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any

from dateutil import parser as date_parser
from PIL import Image
from pypdf import PdfReader


SUPPORTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt", ".md"}

PRIORITY_MAP = {
    "critical": "urgent",
    "urgente": "urgent",
    "urgent": "urgent",
    "alta": "high",
    "high": "high",
    "medio": "medium",
    "media": "medium",
    "medium": "medium",
    "baja": "low",
    "low": "low"
}

CATEGORY_KEYWORDS = {
    "access": ["password", "login", "access", "usuario", "clave", "2fa", "mfa"],
    "billing": ["billing", "invoice", "cobro", "payment", "pago", "facturacion"],
    "bug": ["error", "bug", "falla", "crash", "pantalla", "exception"],
    "outage": ["caido", "outage", "no funciona", "sin servicio", "intermitente"],
    "request": ["solicitud", "request", "alta de usuario", "nuevo acceso", "permiso"],
    "form": ["formulario", "form", "captura", "ticket"]
}

ESSENTIAL_FIELDS = ["category", "priority", "issue_summary", "suggested_action"]


@dataclass
class DocumentBundle:
    filename: str
    content_type: str
    extension: str
    size_bytes: int
    raw_bytes: bytes
    saved_path: Path
    cached_payload: dict[str, Any] | None = field(default=None)

    @property
    def guessed_mime_type(self) -> str:
        return self.content_type or mimetypes.guess_type(self.filename)[0] or "application/octet-stream"

    @property
    def is_image(self) -> bool:
        return self.extension in {".png", ".jpg", ".jpeg", ".webp"}


def build_tool_specs() -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": "extract_document_payload",
                "description": "Lee el archivo, extrae texto, metadatos y senales utiles para clasificar un documento de soporte.",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": {"type": "string"},
                        "focus": {"type": "string"}
                    },
                    "required": ["reason", "focus"],
                    "additionalProperties": False
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "normalize_support_fields",
                "description": "Normaliza fechas, prioridad y categoria del candidato actual antes del resultado final.",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": {"type": "string"},
                        "candidate": {
                            "type": "object",
                            "additionalProperties": True
                        }
                    },
                    "required": ["reason", "candidate"],
                    "additionalProperties": False
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "validate_candidate_result",
                "description": "Valida faltantes, inconsistencias y necesidad de aclaraciones antes de devolver el JSON final.",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": {"type": "string"},
                        "candidate": {
                            "type": "object",
                            "additionalProperties": True
                        }
                    },
                    "required": ["reason", "candidate"],
                    "additionalProperties": False
                }
            }
        }
    ]


def run_tool(tool_name: str, arguments: dict[str, Any], bundle: DocumentBundle) -> dict[str, Any]:
    if tool_name == "extract_document_payload":
        return extract_document_payload(bundle, focus=arguments.get("focus", "general"))

    if tool_name == "normalize_support_fields":
        return normalize_support_fields(arguments.get("candidate", {}))

    if tool_name == "validate_candidate_result":
        return validate_candidate_result(arguments.get("candidate", {}))

    return {"tool_error": f"Herramienta desconocida: {tool_name}"}


def extract_document_payload(bundle: DocumentBundle, focus: str = "general") -> dict[str, Any]:
    if bundle.cached_payload is not None:
        return bundle.cached_payload

    text_content = ""
    warnings: list[str] = []
    image_dimensions: dict[str, int] | None = None

    try:
        if bundle.extension == ".pdf":
            reader = PdfReader(BytesIO(bundle.raw_bytes))
            pages = [page.extract_text() or "" for page in reader.pages[:6]]
            text_content = "\n".join(pages).strip()
        elif bundle.extension in {".txt", ".md"}:
            text_content = bundle.raw_bytes.decode("utf-8", errors="ignore").strip()
        elif bundle.is_image:
            with Image.open(BytesIO(bundle.raw_bytes)) as image:
                image_dimensions = {"width": image.width, "height": image.height}
        else:
            warnings.append("No existe extractor local para este formato.")
    except Exception as exc:
        warnings.append(f"No se pudo extraer contenido local del archivo: {exc}")

    lowered = text_content.lower()
    category_candidates = [
        name
        for name, keywords in CATEGORY_KEYWORDS.items()
        if any(keyword in lowered for keyword in keywords)
    ]
    priority_candidates = [
        normalized
        for raw, normalized in PRIORITY_MAP.items()
        if raw in lowered
    ]
    date_candidates = re.findall(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", text_content)
    ticket_candidates = re.findall(
        r"(?:ticket|case|incidencia|folio|id)\s*[:#-]?\s*([A-Z0-9-]{3,})",
        text_content,
        flags=re.IGNORECASE
    )

    payload = {
        "filename": bundle.filename,
        "mime_type": bundle.guessed_mime_type,
        "size_bytes": bundle.size_bytes,
        "focus": focus,
        "text_excerpt": text_content[:2400],
        "text_length": len(text_content),
        "image_dimensions": image_dimensions,
        "ticket_candidates": ticket_candidates[:5],
        "date_candidates": date_candidates[:5],
        "category_candidates": category_candidates[:3],
        "priority_candidates": list(dict.fromkeys(priority_candidates))[:3],
        "warnings": warnings
    }
    bundle.cached_payload = payload
    return payload


def normalize_support_fields(candidate: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(candidate)
    notes: list[str] = []

    priority = str(candidate.get("priority") or "").strip().lower()
    if priority in PRIORITY_MAP:
        normalized["priority"] = PRIORITY_MAP[priority]
        notes.append("priority normalizada")

    category = str(candidate.get("category") or "").strip().lower()
    for normalized_category, keywords in CATEGORY_KEYWORDS.items():
        if category == normalized_category or category in keywords:
            normalized["category"] = normalized_category
            notes.append("category normalizada")
            break

    incident_date = str(candidate.get("incident_date") or "").strip()
    if incident_date:
        try:
            parsed_date = date_parser.parse(incident_date, dayfirst=True)
            normalized["incident_date"] = parsed_date.date().isoformat()
            notes.append("fecha normalizada")
        except Exception:
            notes.append("fecha no pudo normalizarse")

    return {"normalized_candidate": normalized, "normalization_notes": notes}


def validate_candidate_result(candidate: dict[str, Any]) -> dict[str, Any]:
    missing_fields: list[str] = []
    context_gaps: list[str] = []
    warnings: list[str] = []
    questions: list[str] = []
    normalized_candidate = dict(candidate)

    for field_name in ESSENTIAL_FIELDS:
        raw_value = candidate.get(field_name)
        if raw_value is None or (isinstance(raw_value, str) and not raw_value.strip()):
            missing_fields.append(field_name)

    if not candidate.get("reporter_name"):
        context_gaps.append("reporter_name")
        questions.append("¿Quien reporta el incidente o a nombre de que usuario se debe registrar?")
    if not candidate.get("incident_date"):
        context_gaps.append("incident_date")
        questions.append("¿En que fecha ocurrio el problema o desde cuando se detecto?")
    if not candidate.get("ticket_id"):
        context_gaps.append("ticket_id")
        questions.append("¿Existe numero de ticket, folio o identificador del caso?")
    if not candidate.get("issue_summary"):
        questions.append("¿Cual es el problema exacto que se observa en la captura o documento?")
    if not candidate.get("suggested_action"):
        questions.append("¿Que accion espera soporte: desbloqueo, revision tecnica, seguimiento o escalamiento?")

    if candidate.get("document_type") not in {"support_document", "other", "unknown"}:
        warnings.append("El contenido parece no pertenecer al flujo de soporte definido en la opcion D.")
    if missing_fields:
        warnings.append("Faltan campos clave para cerrar el caso con confianza.")
    if len(context_gaps) >= 2 and candidate.get("document_type") == "support_document":
        warnings.append("Falta contexto operativo para cerrar el triage sin aclaraciones.")
    if candidate.get("priority") == "urgent" and not candidate.get("suggested_action"):
        warnings.append("El caso parece urgente, pero no se describio una accion inmediata.")

    normalized_candidate["missing_fields"] = list(dict.fromkeys(missing_fields + context_gaps))

    needs_review = bool(missing_fields) or (
        len(context_gaps) >= 2 and candidate.get("document_type") == "support_document"
    )
    status = "needs_review" if needs_review else "success"
    needs_clarification = needs_review

    return {
        "status_suggestion": status,
        "needs_clarification": needs_clarification,
        "missing_fields": normalized_candidate["missing_fields"],
        "warnings": warnings,
        "clarifying_questions": questions[:3],
        "validated_candidate": normalized_candidate
    }


def make_error_response(message: str, tool: str, reason: str) -> dict[str, Any]:
    return {
        "status": "error",
        "document_type": "unknown",
        "summary": message,
        "extracted_data": {
            "classification": None,
            "category": None,
            "priority": None,
            "suggested_action": None,
            "alert_level": None,
            "ticket_id": None,
            "reporter_name": None,
            "organization": None,
            "incident_date": None,
            "contact_channel": None,
            "product_area": None,
            "issue_summary": None,
            "evidence_found": [],
            "missing_fields": []
        },
        "warnings": [message],
        "needs_clarification": False,
        "clarifying_questions": [],
        "tool_trace": [{"tool": tool, "reason": reason, "success": False}]
    }


def sanitize_filename(filename: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", filename)
    return cleaned or f"upload-{datetime.now().strftime('%Y%m%d%H%M%S')}"
