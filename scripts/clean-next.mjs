import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
for (const name of [".next", "out"]) {
  const p = join(root, name);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log("removed", name);
  }
}
