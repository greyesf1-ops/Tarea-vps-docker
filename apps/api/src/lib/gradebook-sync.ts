import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ExcelSyncInfo, GradebookSnapshot } from "@invoice/shared";

import { env } from "./env.js";
import { buildGradebookWorkbook } from "./gradebook-excel.js";

let lastSyncedAt: string | null = null;

export function getExcelSyncInfo(): ExcelSyncInfo {
  return {
    exportPath: env.gradebookExportPath,
    lastSyncedAt
  };
}

export async function persistSnapshotToExcel(snapshot: GradebookSnapshot) {
  const buffer = buildGradebookWorkbook(snapshot);

  await mkdir(dirname(env.gradebookExportPath), { recursive: true });
  await writeFile(env.gradebookExportPath, buffer);

  lastSyncedAt = new Date().toISOString();

  return getExcelSyncInfo();
}

export async function tryPersistSnapshotToExcel(snapshot: GradebookSnapshot) {
  try {
    return await persistSnapshotToExcel(snapshot);
  } catch (error) {
    console.error("No se pudo sincronizar el Excel local.", error);
    return getExcelSyncInfo();
  }
}
