import { z } from "zod";

export const analysisStatusSchema = z.enum([
  "success",
  "needs_review",
  "error"
]);

export const documentTypeSchema = z.enum([
  "lab_result",
  "academic_document",
  "medical_document",
  "support_document",
  "other",
  "unknown"
]);

export const supportExtractedDataSchema = z
  .object({
    classification: z.string().nullable().default(null),
    category: z.string().nullable().default(null),
    priority: z.string().nullable().default(null),
    suggested_action: z.string().nullable().default(null),
    alert_level: z.string().nullable().default(null),
    ticket_id: z.string().nullable().default(null),
    reporter_name: z.string().nullable().default(null),
    organization: z.string().nullable().default(null),
    incident_date: z.string().nullable().default(null),
    contact_channel: z.string().nullable().default(null),
    product_area: z.string().nullable().default(null),
    issue_summary: z.string().nullable().default(null),
    evidence_found: z.array(z.string()).default([]),
    missing_fields: z.array(z.string()).default([])
  })
  .passthrough();

export const toolTraceEntrySchema = z.object({
  tool: z.string().min(1),
  reason: z.string().min(1),
  success: z.boolean()
});

export const supportAnalysisResponseSchema = z.object({
  status: analysisStatusSchema,
  document_type: documentTypeSchema,
  summary: z.string(),
  extracted_data: supportExtractedDataSchema,
  warnings: z.array(z.string()),
  needs_clarification: z.boolean(),
  clarifying_questions: z.array(z.string()),
  tool_trace: z.array(toolTraceEntrySchema)
});

export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type SupportExtractedData = z.infer<typeof supportExtractedDataSchema>;
export type ToolTraceEntry = z.infer<typeof toolTraceEntrySchema>;
export type SupportAnalysisResponse = z.infer<
  typeof supportAnalysisResponseSchema
>;
