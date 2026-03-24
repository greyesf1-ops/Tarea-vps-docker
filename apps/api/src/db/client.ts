import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "../lib/env.js";
import * as schema from "./schema.js";

if (env.DATABASE_PROVIDER !== "sqlite") {
  throw new Error(
    "Solo sqlite está implementado por ahora. La capa de configuración ya está preparada para migrar a PostgreSQL."
  );
}

mkdirSync(dirname(env.sqliteDbPath), { recursive: true });

export const sqliteClient = createClient({
  url: env.sqliteDbUrl
});

export const db = drizzle(sqliteClient, { schema });
