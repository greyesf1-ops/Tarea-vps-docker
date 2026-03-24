import { z } from "zod";

export const activityKindSchema = z.enum(["TAREA", "PRACTICA", "EVALUACION"]);

export const studentSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  code: z.string().nullable(),
  position: z.number().int().nonnegative()
});

export const assessmentSchema = z.object({
  id: z.string(),
  key: z.string().min(1),
  title: z.string().min(1),
  kind: activityKindSchema,
  maxPoints: z.number().positive(),
  dueDate: z.string().nullable(),
  position: z.number().int().nonnegative()
});

export const gradeEntrySchema = z.object({
  studentId: z.string(),
  assessmentId: z.string(),
  score: z.number().nonnegative().nullable()
});

export const studentSummarySchema = z.object({
  studentId: z.string(),
  totalScore: z.number().nonnegative(),
  possibleScore: z.number().nonnegative(),
  percentage: z.number().nonnegative(),
  pendingCount: z.number().int().nonnegative()
});

export const gradebookStatsSchema = z.object({
  studentCount: z.number().int().nonnegative(),
  assessmentCount: z.number().int().nonnegative(),
  taskCount: z.number().int().nonnegative(),
  practiceCount: z.number().int().nonnegative(),
  evaluationCount: z.number().int().nonnegative(),
  classAverage: z.number().nonnegative(),
  completionRate: z.number().nonnegative(),
  maxPossiblePoints: z.number().nonnegative()
});

export const gradebookSnapshotSchema = z.object({
  courseName: z.string().min(1),
  students: z.array(studentSchema),
  assessments: z.array(assessmentSchema),
  grades: z.array(gradeEntrySchema),
  summaries: z.array(studentSummarySchema),
  stats: gradebookStatsSchema,
  importedAt: z.string().nullable(),
  updatedAt: z.string().nullable()
});

export const excelSyncInfoSchema = z.object({
  exportPath: z.string(),
  lastSyncedAt: z.string().nullable()
});

export const updateGradeInputSchema = z.object({
  studentId: z.string(),
  assessmentId: z.string(),
  score: z.number().nonnegative().nullable()
});

export const createStudentInputSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().optional().transform((value) => {
    if (!value) {
      return null;
    }

    return value;
  })
});

export type ActivityKind = z.infer<typeof activityKindSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type CreateStudentInput = z.infer<typeof createStudentInputSchema>;
export type ExcelSyncInfo = z.infer<typeof excelSyncInfoSchema>;
export type GradeEntry = z.infer<typeof gradeEntrySchema>;
export type GradebookSnapshot = z.infer<typeof gradebookSnapshotSchema>;
export type GradebookStats = z.infer<typeof gradebookStatsSchema>;
export type Student = z.infer<typeof studentSchema>;
export type StudentSummary = z.infer<typeof studentSummarySchema>;
export type UpdateGradeInput = z.infer<typeof updateGradeInputSchema>;
