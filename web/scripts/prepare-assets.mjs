import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const publicDir = path.join(root, "web", "public");

// Public генерируется перед dev и build
await mkdir(publicDir, { recursive: true });
await copyFile(
  path.join(root, "sto-rules.pdf"),
  path.join(publicDir, "sto-rules.pdf"),
);
console.log("Copied sto-rules.pdf to web/public");
