/**
 * Статический экспорт (Firebase Hosting) не поддерживает Route Handlers в app/api.
 * Временно переносим папку за пределы app/, собираем, возвращаем обратно.
 */
import { existsSync, renameSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const root = join(import.meta.dirname, "..");
const apiDir = join(root, "src", "app", "api");
const stashDir = join(root, "src", "_api_stash_for_static_export");

function stash() {
  if (!existsSync(apiDir)) return;
  if (existsSync(stashDir)) {
    console.error("[static-export] уже существует", stashDir);
    process.exit(1);
  }
  renameSync(apiDir, stashDir);
  console.log("[static-export] временно перенесено:", apiDir, "→", stashDir);
}

function restore() {
  if (!existsSync(stashDir)) return;
  if (existsSync(apiDir)) {
    console.error("[static-export] восстановление: api уже существует", apiDir);
    process.exit(1);
  }
  renameSync(stashDir, apiDir);
  console.log("[static-export] восстановлено:", stashDir, "→", apiDir);
}

const cmd = process.argv[2];
if (cmd === "stash") {
  stash();
  process.exit(0);
}
if (cmd === "restore") {
  restore();
  process.exit(0);
}
if (cmd === "build") {
  stash();
  let exitCode = 1;
  try {
    const r = spawnSync(
      process.execPath,
      [join(root, "node_modules", "next", "dist", "bin", "next"), "build"],
      {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env, STATIC_EXPORT: "1" },
      },
    );
    exitCode = r.status === 0 ? 0 : r.status ?? 1;
  } finally {
    restore();
  }
  process.exit(exitCode);
}

console.error("Использование: node scripts/static-export-without-api.mjs stash|restore|build");
process.exit(1);
