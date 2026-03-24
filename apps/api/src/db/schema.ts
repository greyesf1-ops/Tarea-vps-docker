import { relations } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";

export const activityKindValues = ["TAREA", "PRACTICA", "EVALUACION"] as const;

export const gradebookSettings = sqliteTable("gradebook_settings", {
  id: text("id").primaryKey(),
  courseName: text("course_name").notNull().default("Curso sin nombre"),
  importedAt: text("imported_at"),
  updatedAt: text("updated_at").notNull()
});

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  position: integer("position").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const assessments = sqliteTable("assessments", {
  id: text("id").primaryKey(),
  activityKey: text("activity_key").notNull(),
  title: text("title").notNull(),
  kind: text("kind", { enum: activityKindValues }).notNull(),
  maxPoints: real("max_points").notNull(),
  dueDate: text("due_date"),
  position: integer("position").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const grades = sqliteTable(
  "grades",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    score: real("score"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    studentAssessmentUnique: uniqueIndex("grades_student_assessment_idx").on(
      table.studentId,
      table.assessmentId
    )
  })
);

export const studentRelations = relations(students, ({ many }) => ({
  grades: many(grades)
}));

export const assessmentRelations = relations(assessments, ({ many }) => ({
  grades: many(grades)
}));

export const gradeRelations = relations(grades, ({ one }) => ({
  student: one(students, {
    fields: [grades.studentId],
    references: [students.id]
  }),
  assessment: one(assessments, {
    fields: [grades.assessmentId],
    references: [assessments.id]
  })
}));
