from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StatusEnum(str, Enum):
    SUCCESS = "success"
    NEEDS_REVIEW = "needs_review"
    ERROR = "error"


class DocumentTypeEnum(str, Enum):
    LAB_RESULT = "lab_result"
    ACADEMIC_DOCUMENT = "academic_document"
    MEDICAL_DOCUMENT = "medical_document"
    SUPPORT_DOCUMENT = "support_document"
    OTHER = "other"
    UNKNOWN = "unknown"


class ToolTraceItem(BaseModel):
    tool: str
    reason: str
    success: bool


class ExtractedData(BaseModel):
    model_config = ConfigDict(extra="allow")

    classification: str | None = None
    category: str | None = None
    priority: str | None = None
    suggested_action: str | None = None
    alert_level: str | None = None
    ticket_id: str | None = None
    reporter_name: str | None = None
    organization: str | None = None
    incident_date: str | None = None
    contact_channel: str | None = None
    product_area: str | None = None
    issue_summary: str | None = None
    evidence_found: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)


class AnalysisResponse(BaseModel):
    status: StatusEnum
    document_type: DocumentTypeEnum
    summary: str
    extracted_data: ExtractedData
    warnings: list[str] = Field(default_factory=list)
    needs_clarification: bool = False
    clarifying_questions: list[str] = Field(default_factory=list)
    tool_trace: list[ToolTraceItem] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_questions(self) -> "AnalysisResponse":
        if self.needs_clarification and len(self.clarifying_questions) < 2:
            raise ValueError(
                "clarifying_questions debe incluir al menos 2 preguntas cuando needs_clarification es true."
            )

        if not self.needs_clarification:
            self.clarifying_questions = []

        return self
