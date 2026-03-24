import { defineConfig } from "drizzle-kit";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDir, "../..");
const sqlitePath = process.env.SQLITE_DB_PATH
  ? resolve(workspaceRoot, process.env.SQLITE_DB_PATH)
  : resolve(workspaceRoot, "storage/gradebook.sqlite");
const sqliteUrl = `file:${sqlitePath.replace(/\\/g, "/")}`;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: sqliteUrl
  }
});
