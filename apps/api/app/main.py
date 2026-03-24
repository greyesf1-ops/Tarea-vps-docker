from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .agent import analyze_document
from .config import get_settings
from .models import AnalysisResponse
from .tools import (
    DocumentBundle,
    SUPPORTED_EXTENSIONS,
    make_error_response,
    sanitize_filename
)


settings = get_settings()
settings.upload_path.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Support Intake AI API",
    description="Backend FastAPI para clasificar y extraer documentos de soporte con IA.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/health")
def health_check() -> dict[str, str | bool]:
    return {"ok": True, "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(file: UploadFile = File(...)) -> AnalysisResponse:
    filename = file.filename or "archivo-sin-nombre"
    extension = Path(filename).suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        return AnalysisResponse.model_validate(
            make_error_response(
                "Formato no soportado. Usa PDF, PNG, JPG, WEBP, TXT o MD.",
                tool="validate_upload",
                reason="Verificar que el archivo pertenece a un formato permitido antes de procesarlo."
            )
        )

    raw_bytes = await file.read()
    if not raw_bytes:
        return AnalysisResponse.model_validate(
            make_error_response(
                "El archivo esta vacio y no puede procesarse.",
                tool="validate_upload",
                reason="Comprobar que el archivo tenga contenido antes de iniciar el workflow."
            )
        )

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(raw_bytes) > max_bytes:
        return AnalysisResponse.model_validate(
            make_error_response(
                f"El archivo excede el limite de {settings.max_upload_size_mb} MB.",
                tool="validate_upload",
                reason="Proteger la API de archivos demasiado pesados para el flujo de analisis."
            )
        )

    safe_name = sanitize_filename(filename)
    saved_path = settings.upload_path / f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{safe_name}"
    saved_path.write_bytes(raw_bytes)

    bundle = DocumentBundle(
        filename=filename,
        content_type=file.content_type or "",
        extension=extension,
        size_bytes=len(raw_bytes),
        raw_bytes=raw_bytes,
        saved_path=saved_path
    )

    try:
        return analyze_document(bundle)
    except Exception as exc:
        return AnalysisResponse.model_validate(
            make_error_response(
                f"No se pudo completar el analisis del documento: {exc}",
                tool="llm_orchestrator",
                reason="Ejecutar el workflow agentic y capturar errores controlados."
            )
        )
