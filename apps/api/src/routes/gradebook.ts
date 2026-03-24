import { createStudentInputSchema, updateGradeInputSchema } from "@invoice/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import {
  createStudent,
  getGradebookSnapshot,
  replaceGradebook,
  updateGradeScore
} from "../db/repository.js";
import {
  buildGradebookWorkbook,
  buildTemplateWorkbook,
  parseGradebookWorkbook
} from "../lib/gradebook-excel.js";
import {
  getExcelSyncInfo,
  persistSnapshotToExcel,
  tryPersistSnapshotToExcel
} from "../lib/gradebook-sync.js";

const maxUploadSizeInBytes = 10 * 1024 * 1024;

export const gradebookRoutes = new Hono();

gradebookRoutes.get("/", async (c) => {
  const snapshot = await getGradebookSnapshot();
  return c.json({ snapshot, syncInfo: getExcelSyncInfo() });
});

gradebookRoutes.get("/template", (c) => {
  const buffer = buildTemplateWorkbook();

  return c.body(buffer, 200, {
    "Content-Disposition": 'attachment; filename="plantilla-control-notas.xlsx"',
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
});

gradebookRoutes.post("/import-excel", async (c) => {
  const formData = await c.req.formData();
  const uploaded = formData.get("file");

  if (!(uploaded instanceof File)) {
    throw new HTTPException(400, { message: "Debes subir un archivo Excel." });
  }

  if (uploaded.size > maxUploadSizeInBytes) {
    throw new HTTPException(400, {
      message: "El archivo excede el limite de 10 MB."
    });
  }

  const extension = uploaded.name.slice(uploaded.name.lastIndexOf(".")).toLowerCase();
  if (extension !== ".xlsx") {
    throw new HTTPException(400, {
      message: "Solo se aceptan archivos .xlsx."
    });
  }

  const buffer = Buffer.from(await uploaded.arrayBuffer());

  try {
    const importData = parseGradebookWorkbook(buffer);
    const snapshot = await replaceGradebook(importData);
    const syncInfo = await tryPersistSnapshotToExcel(snapshot);
    return c.json({ snapshot, syncInfo });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo importar el Excel.";
    throw new HTTPException(400, { message });
  }
});

gradebookRoutes.patch("/grades", async (c) => {
  const payload = updateGradeInputSchema.parse(await c.req.json());

  try {
    const snapshot = await updateGradeScore(payload);
    const syncInfo = await tryPersistSnapshotToExcel(snapshot);
    return c.json({ snapshot, syncInfo });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar la nota.";
    throw new HTTPException(400, { message });
  }
});

gradebookRoutes.post("/students", async (c) => {
  const payload = createStudentInputSchema.parse(await c.req.json());

  try {
    const snapshot = await createStudent(payload);
    const syncInfo = await tryPersistSnapshotToExcel(snapshot);
    return c.json({ snapshot, syncInfo });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear el alumno.";
    throw new HTTPException(400, { message });
  }
});

gradebookRoutes.post("/sync-excel", async (c) => {
  const snapshot = await getGradebookSnapshot();

  try {
    const syncInfo = await persistSnapshotToExcel(snapshot);
    return c.json({ snapshot, syncInfo });
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.message}. Si el archivo esta abierto en Excel, cierralo y vuelve a intentar.`
        : "No se pudo actualizar el Excel local.";
    throw new HTTPException(400, { message });
  }
});

gradebookRoutes.get("/export-excel", async (c) => {
  const snapshot = await getGradebookSnapshot();
  const syncInfo = await tryPersistSnapshotToExcel(snapshot);

  return c.body(buildGradebookWorkbook(snapshot), 200, {
    "Content-Disposition": 'attachment; filename="control-calificaciones-actualizado.xlsx"',
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "X-Export-Path": syncInfo.exportPath
  });
});
