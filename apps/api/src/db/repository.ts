import { randomUUID } from "node:crypto";

import type {
  ActivityKind,
  CreateStudentInput,
  GradebookSnapshot,
  UpdateGradeInput
} from "@invoice/shared";
import { and, asc, eq } from "drizzle-orm";

import { db } from "./client.js";
import {
  assessments,
  gradebookSettings,
  grades,
  students
} from "./schema.js";

type StudentRow = typeof students.$inferSelect;
type AssessmentRow = typeof assessments.$inferSelect;
type GradeRow = typeof grades.$inferSelect;

type ImportedStudent = {
  name: string;
  code: string | null;
  position: number;
};

type ImportedAssessment = {
  key: string;
  title: string;
  kind: ActivityKind;
  maxPoints: number;
  dueDate: string | null;
  position: number;
};

type ImportedGrade = {
  studentName: string;
  assessmentKey: string;
  score: number | null;
};

type GradebookImport = {
  courseName: string;
  importedAt: string;
  students: ImportedStudent[];
  assessments: ImportedAssessment[];
  grades: ImportedGrade[];
};

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function mapSnapshot(params: {
  settings: typeof gradebookSettings.$inferSelect | null;
  students: StudentRow[];
  assessments: AssessmentRow[];
  grades: GradeRow[];
}): GradebookSnapshot {
  const mappedStudents = params.students.map((student) => ({
    id: student.id,
    name: student.name,
    code: student.code ?? null,
    position: student.position
  }));

  const mappedAssessments = params.assessments.map((assessment) => ({
    id: assessment.id,
    key: assessment.activityKey,
    title: assessment.title,
    kind: assessment.kind,
    maxPoints: assessment.maxPoints,
    dueDate: assessment.dueDate ?? null,
    position: assessment.position
  }));

  const mappedGrades = params.grades.map((grade) => ({
    studentId: grade.studentId,
    assessmentId: grade.assessmentId,
    score: grade.score ?? null
  }));

  const maxPossiblePoints = roundToTwo(
    mappedAssessments.reduce((total, assessment) => total + assessment.maxPoints, 0)
  );

  const summaries = mappedStudents.map((student) => {
    const studentGrades = mappedGrades.filter(
      (grade) => grade.studentId === student.id
    );
    const totalScore = roundToTwo(
      studentGrades.reduce((total, grade) => total + (grade.score ?? 0), 0)
    );
    const pendingCount = studentGrades.filter((grade) => grade.score === null).length;
    const percentage =
      maxPossiblePoints > 0 ? roundToTwo((totalScore / maxPossiblePoints) * 100) : 0;

    return {
      studentId: student.id,
      totalScore,
      possibleScore: maxPossiblePoints,
      percentage,
      pendingCount
    };
  });

  const taskCount = mappedAssessments.filter(
    (assessment) => assessment.kind === "TAREA"
  ).length;
  const practiceCount = mappedAssessments.filter(
    (assessment) => assessment.kind === "PRACTICA"
  ).length;
  const evaluationCount = mappedAssessments.filter(
    (assessment) => assessment.kind === "EVALUACION"
  ).length;
  const classAverage =
    summaries.length > 0
      ? roundToTwo(
          summaries.reduce((total, summary) => total + summary.percentage, 0) /
            summaries.length
        )
      : 0;

  const totalExpectedGrades = mappedStudents.length * mappedAssessments.length;
  const registeredGrades = mappedGrades.filter((grade) => grade.score !== null).length;
  const completionRate =
    totalExpectedGrades > 0
      ? roundToTwo((registeredGrades / totalExpectedGrades) * 100)
      : 0;

  return {
    courseName: params.settings?.courseName ?? "Curso sin nombre",
    students: mappedStudents,
    assessments: mappedAssessments,
    grades: mappedGrades,
    summaries,
    stats: {
      studentCount: mappedStudents.length,
      assessmentCount: mappedAssessments.length,
      taskCount,
      practiceCount,
      evaluationCount,
      classAverage,
      completionRate,
      maxPossiblePoints
    },
    importedAt: params.settings?.importedAt ?? null,
    updatedAt: params.settings?.updatedAt ?? null
  };
}

export async function getGradebookSnapshot() {
  const [settingsRow] = await db.select().from(gradebookSettings);
  const studentRows = await db.select().from(students).orderBy(asc(students.position));
  const assessmentRows = await db
    .select()
    .from(assessments)
    .orderBy(asc(assessments.position));
  const gradeRows = await db.select().from(grades);

  return mapSnapshot({
    settings: settingsRow ?? null,
    students: studentRows,
    assessments: assessmentRows,
    grades: gradeRows
  });
}

export async function replaceGradebook(importData: GradebookImport) {
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.delete(grades);
    await tx.delete(students);
    await tx.delete(assessments);
    await tx.delete(gradebookSettings);

    await tx.insert(gradebookSettings).values({
      id: "main",
      courseName: importData.courseName,
      importedAt: importData.importedAt,
      updatedAt: now
    });

    const studentIdsByName = new Map<string, string>();
    const assessmentIdsByKey = new Map<string, string>();

    if (importData.students.length > 0) {
      await tx.insert(students).values(
        importData.students.map((student) => {
          const id = randomUUID();
          studentIdsByName.set(student.name, id);

          return {
            id,
            name: student.name,
            code: student.code,
            position: student.position,
            createdAt: now,
            updatedAt: now
          };
        })
      );
    }

    if (importData.assessments.length > 0) {
      await tx.insert(assessments).values(
        importData.assessments.map((assessment) => {
          const id = randomUUID();
          assessmentIdsByKey.set(assessment.key, id);

          return {
            id,
            activityKey: assessment.key,
            title: assessment.title,
            kind: assessment.kind,
            maxPoints: assessment.maxPoints,
            dueDate: assessment.dueDate,
            position: assessment.position,
            createdAt: now,
            updatedAt: now
          };
        })
      );
    }

    const gradeValues = importData.grades
      .map((grade) => {
        const studentId = studentIdsByName.get(grade.studentName);
        const assessmentId = assessmentIdsByKey.get(grade.assessmentKey);

        if (!studentId || !assessmentId) {
          return null;
        }

        return {
          id: randomUUID(),
          studentId,
          assessmentId,
          score: grade.score,
          createdAt: now,
          updatedAt: now
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);

    if (gradeValues.length > 0) {
      await tx.insert(grades).values(gradeValues);
    }
  });

  return getGradebookSnapshot();
}

export async function updateGradeScore(input: UpdateGradeInput) {
  const now = new Date().toISOString();
  const [studentExists] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.id, input.studentId));
  const [assessmentExists] = await db
    .select({ id: assessments.id, maxPoints: assessments.maxPoints })
    .from(assessments)
    .where(eq(assessments.id, input.assessmentId));

  if (!studentExists || !assessmentExists) {
    throw new Error("No se encontro el alumno o la actividad a editar.");
  }

  if (input.score !== null && input.score > assessmentExists.maxPoints) {
    throw new Error("La nota no puede ser mayor que los puntos maximos de la actividad.");
  }

  const [existingGrade] = await db
    .select()
    .from(grades)
    .where(
      and(eq(grades.studentId, input.studentId), eq(grades.assessmentId, input.assessmentId))
    );

  if (existingGrade) {
    await db
      .update(grades)
      .set({
        score: input.score,
        updatedAt: now
      })
      .where(eq(grades.id, existingGrade.id));
  } else {
    await db.insert(grades).values({
      id: randomUUID(),
      studentId: input.studentId,
      assessmentId: input.assessmentId,
      score: input.score,
      createdAt: now,
      updatedAt: now
    });
  }

  await db
    .update(gradebookSettings)
    .set({
      updatedAt: now
    })
    .where(eq(gradebookSettings.id, "main"));

  return getGradebookSnapshot();
}

export async function createStudent(input: CreateStudentInput) {
  const now = new Date().toISOString();
  const normalizedName = input.name.trim();
  const normalizedCode = input.code?.trim() || null;

  const existingStudents = await db.select().from(students).orderBy(asc(students.position));
  if (
    existingStudents.some(
      (student) => student.name.toLowerCase() === normalizedName.toLowerCase()
    )
  ) {
    throw new Error("Ya existe un alumno con ese nombre.");
  }

  const studentId = randomUUID();
  const nextPosition =
    existingStudents.length > 0
      ? Math.max(...existingStudents.map((student) => student.position)) + 1
      : 0;

  const assessmentRows = await db
    .select()
    .from(assessments)
    .orderBy(asc(assessments.position));

  await db.transaction(async (tx) => {
    const [settingsRow] = await tx.select().from(gradebookSettings);

    if (!settingsRow) {
      await tx.insert(gradebookSettings).values({
        id: "main",
        courseName: "Control de calificaciones",
        importedAt: null,
        updatedAt: now
      });
    } else {
      await tx
        .update(gradebookSettings)
        .set({
          updatedAt: now
        })
        .where(eq(gradebookSettings.id, "main"));
    }

    await tx.insert(students).values({
      id: studentId,
      name: normalizedName,
      code: normalizedCode,
      position: nextPosition,
      createdAt: now,
      updatedAt: now
    });

    if (assessmentRows.length > 0) {
      await tx.insert(grades).values(
        assessmentRows.map((assessment) => ({
          id: randomUUID(),
          studentId,
          assessmentId: assessment.id,
          score: null,
          createdAt: now,
          updatedAt: now
        }))
      );
    }
  });

  return getGradebookSnapshot();
}
