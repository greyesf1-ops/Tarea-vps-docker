import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export function findWorkspaceRoot(startDir = process.cwd()) {
  let currentDir = startDir;

  while (true) {
    if (
      existsSync(join(currentDir, "package.json")) &&
      existsSync(join(currentDir, "turbo.json"))
    ) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return startDir;
    }

    currentDir = parentDir;
  }
}

export function resolveWorkspacePath(filePath: string) {
  if (isAbsolute(filePath)) {
    return filePath;
  }

  return resolve(findWorkspaceRoot(), filePath);
}
