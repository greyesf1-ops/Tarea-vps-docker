import "dotenv/config";

import { z } from "zod";

import { resolveWorkspacePath } from "./workspace.js";

const envSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_PROVIDER: z.enum(["sqlite", "postgres"]).default("sqlite"),
  SQLITE_DB_PATH: z.string().default("storage/gradebook.sqlite"),
  GRADEBOOK_EXPORT_PATH: z
    .string()
    .default("storage/exports/control-calificaciones-actualizado.xlsx")
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  sqliteDbPath: resolveWorkspacePath(parsedEnv.SQLITE_DB_PATH),
  sqliteDbUrl: `file:${resolveWorkspacePath(parsedEnv.SQLITE_DB_PATH).replace(/\\/g, "/")}`,
  gradebookExportPath: resolveWorkspacePath(parsedEnv.GRADEBOOK_EXPORT_PATH)
};
