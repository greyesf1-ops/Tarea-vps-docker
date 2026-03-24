import type { ActivityKind, GradebookSnapshot } from "@invoice/shared";
import * as XLSX from "xlsx";

type ImportGradebook = {
  courseName: string;
  importedAt: string;
  students: Array<{
    name: string;
    code: string | null;
    position: number;
  }>;
  assessments: Array<{
    key: string;
    title: string;
    kind: ActivityKind;
    maxPoints: number;
    dueDate: string | null;
    position: number;
  }>;
  grades: Array<{
    studentName: string;
    assessmentKey: string;
    score: number | null;
  }>;
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function findSheet(workbook: XLSX.WorkBook, names: string[]) {
  const normalizedNames = new Set(names.map((name) => normalizeHeader(name)));

  return workbook.SheetNames.find((sheetName) =>
    normalizedNames.has(normalizeHeader(sheetName))
  );
}

function parseRows(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false
  });
}

function parseNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value: unknown) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function parseGradebookWorkbook(fileBuffer: Buffer): ImportGradebook {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const importedAt = new Date().toISOString();

  const configSheetName = findSheet(workbook, ["Configuracion", "Config"]);
  const studentsSheetName = findSheet(workbook, ["Alumnos", "Estudiantes"]);
  const assessmentsSheetName = findSheet(workbook, ["Actividades", "Tareas"]);
  const gradesSheetName = findSheet(workbook, ["Notas", "Calificaciones"]);

  if (!studentsSheetName) {
    throw new Error("El archivo Excel debe incluir una hoja llamada Alumnos.");
  }

  if (!assessmentsSheetName) {
    throw new Error("El archivo Excel debe incluir una hoja llamada Actividades.");
  }

  const configRows = configSheetName ? parseRows(workbook.Sheets[configSheetName]) : [];
  const courseConfigRow = configRows.find((row) =>
    ["curso", "course"].includes(normalizeHeader(row.Clave ?? row.Key ?? row.clave))
  );
  const courseName = String(courseConfigRow?.Valor ?? "Control de calificaciones").trim();

  const studentRows = parseRows(workbook.Sheets[studentsSheetName]);
  const students = studentRows
    .map((row, index) => {
      const name = String(row.Nombre ?? row.Alumno ?? row.name ?? "").trim();
      const codeValue = String(row.Codigo ?? row.Código ?? row.Code ?? "").trim();

      if (!name) {
        return null;
      }

      return {
        name,
        code: codeValue || null,
        position: index
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (students.length === 0) {
    throw new Error("La hoja Alumnos no contiene nombres válidos.");
  }

  if (new Set(students.map((student) => student.name)).size !== students.length) {
    throw new Error(
      "La hoja Alumnos tiene nombres repetidos. Cada alumno debe aparecer una sola vez."
    );
  }

  const assessmentRows = parseRows(workbook.Sheets[assessmentsSheetName]);
  const assessments = assessmentRows
    .map((row, index) => {
      const key = String(row.Clave ?? row.ID ?? row.Id ?? "").trim();
      const title = String(row.Nombre ?? row.Actividad ?? row.Title ?? "").trim();
      const rawKind = normalizeHeader(row.Tipo ?? row.type);
      const maxPoints = parseNumber(row.Puntos ?? row.Maximo ?? row["Puntos Maximos"]);

      if (!key || !title || !rawKind || maxPoints === null) {
        return null;
      }

      let kind: ActivityKind;
      if (["evaluacion", "examen"].includes(rawKind)) {
        kind = "EVALUACION";
      } else if (["practica", "laboratorio"].includes(rawKind)) {
        kind = "PRACTICA";
      } else if (["tarea", "actividad"].includes(rawKind)) {
        kind = "TAREA";
      } else {
        throw new Error(
          `La actividad ${title} tiene un tipo invalido. Usa TAREA, PRACTICA o EVALUACION.`
        );
      }

      return {
        key,
        title,
        kind,
        maxPoints,
        dueDate: parseDateValue(row.Fecha ?? row["Fecha Limite"] ?? row.Date),
        position: index
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (assessments.length === 0) {
    throw new Error("La hoja Actividades no tiene actividades válidas.");
  }

  if (new Set(assessments.map((assessment) => assessment.key)).size !== assessments.length) {
    throw new Error(
      "La hoja Actividades tiene claves repetidas. Cada actividad debe tener una clave unica."
    );
  }

  if (!gradesSheetName) {
    return {
      courseName,
      importedAt,
      students,
      assessments,
      grades: students.flatMap((student) =>
        assessments.map((assessment) => ({
          studentName: student.name,
          assessmentKey: assessment.key,
          score: null
        }))
      )
    };
  }

  const gradeRows = parseRows(workbook.Sheets[gradesSheetName]);
  const studentNames = new Set(students.map((student) => student.name));
  const gradeMap = new Map<string, number | null>();

  students.forEach((student) => {
    assessments.forEach((assessment) => {
      gradeMap.set(`${student.name}:${assessment.key}`, null);
    });
  });

  gradeRows.forEach((row) => {
    const studentName = String(row.Alumno ?? row.Nombre ?? row.name ?? "").trim();

    if (!studentName) {
      return;
    }

    if (!studentNames.has(studentName)) {
      throw new Error(
        `La hoja Notas incluye a ${studentName}, pero no existe en la hoja Alumnos.`
      );
    }

    assessments.forEach((assessment) => {
      gradeMap.set(
        `${studentName}:${assessment.key}`,
        parseNumber(row[assessment.key])
      );
    });
  });

  const grades = students.flatMap((student) =>
    assessments.map((assessment) => ({
      studentName: student.name,
      assessmentKey: assessment.key,
      score: gradeMap.get(`${student.name}:${assessment.key}`) ?? null
    }))
  );

  return {
    courseName,
    importedAt,
    students,
    assessments,
    grades
  };
}

export function buildTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();

  const configSheet = XLSX.utils.json_to_sheet([
    { Clave: "curso", Valor: "6to Primaria A" },
    { Clave: "docente", Valor: "Escribe tu nombre" }
  ]);

  const studentsSheet = XLSX.utils.json_to_sheet([
    { Nombre: "Alumno 1", Codigo: "A01" },
    { Nombre: "Alumno 2", Codigo: "A02" },
    { Nombre: "Alumno 3", Codigo: "A03" }
  ]);

  const activitiesSheet = XLSX.utils.json_to_sheet([
    {
      Clave: "T1",
      Tipo: "TAREA",
      Nombre: "Tarea 1",
      Puntos: 10,
      Fecha: "2026-03-20"
    },
    {
      Clave: "T2",
      Tipo: "TAREA",
      Nombre: "Tarea 2",
      Puntos: 15,
      Fecha: "2026-03-27"
    },
    {
      Clave: "E1",
      Tipo: "EVALUACION",
      Nombre: "Evaluacion 1",
      Puntos: 25,
      Fecha: "2026-04-05"
    },
    {
      Clave: "P1",
      Tipo: "PRACTICA",
      Nombre: "Practica 1",
      Puntos: 20,
      Fecha: "2026-04-12"
    }
  ]);

  const gradesSheet = XLSX.utils.json_to_sheet([
    { Alumno: "Alumno 1", T1: 9, T2: 14, E1: 20, P1: 18 },
    { Alumno: "Alumno 2", T1: 10, T2: 12, E1: 22, P1: 17 },
    { Alumno: "Alumno 3", T1: 8, T2: "", E1: 19, P1: 16 }
  ]);

  XLSX.utils.book_append_sheet(workbook, configSheet, "Configuracion");
  XLSX.utils.book_append_sheet(workbook, studentsSheet, "Alumnos");
  XLSX.utils.book_append_sheet(workbook, activitiesSheet, "Actividades");
  XLSX.utils.book_append_sheet(workbook, gradesSheet, "Notas");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function buildGradebookWorkbook(snapshot: GradebookSnapshot) {
  const workbook = XLSX.utils.book_new();

  const configSheet = XLSX.utils.json_to_sheet([
    { Clave: "curso", Valor: snapshot.courseName },
    { Clave: "exportado", Valor: snapshot.updatedAt ?? snapshot.importedAt ?? "" }
  ]);

  const studentsSheet = XLSX.utils.json_to_sheet(
    snapshot.students.map((student) => ({
      Nombre: student.name,
      Codigo: student.code ?? ""
    }))
  );

  const activitiesSheet = XLSX.utils.json_to_sheet(
    snapshot.assessments.map((assessment) => ({
      Clave: assessment.key,
      Tipo: assessment.kind,
      Nombre: assessment.title,
      Puntos: assessment.maxPoints,
      Fecha: assessment.dueDate ?? ""
    }))
  );

  const gradesByStudent = new Map<
    string,
    {
      Alumno: string;
      [key: string]: string | number;
    }
  >();

  snapshot.students.forEach((student) => {
    gradesByStudent.set(student.id, {
      Alumno: student.name
    });
  });

  snapshot.grades.forEach((grade) => {
    const studentRow = gradesByStudent.get(grade.studentId);
    const assessment = snapshot.assessments.find(
      (item) => item.id === grade.assessmentId
    );

    if (!studentRow || !assessment) {
      return;
    }

    studentRow[assessment.key] = grade.score ?? "";
  });

  const gradesSheet = XLSX.utils.json_to_sheet(Array.from(gradesByStudent.values()));

  XLSX.utils.book_append_sheet(workbook, configSheet, "Configuracion");
  XLSX.utils.book_append_sheet(workbook, studentsSheet, "Alumnos");
  XLSX.utils.book_append_sheet(workbook, activitiesSheet, "Actividades");
  XLSX.utils.book_append_sheet(workbook, gradesSheet, "Notas");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
