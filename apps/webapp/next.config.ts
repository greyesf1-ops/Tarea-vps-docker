import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: resolve(currentDir, "../.."),
  output: "standalone",
  transpilePackages: ["@support/shared"]
};

export default nextConfig;
