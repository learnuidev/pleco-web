/**
 * Locating HanziJS' data files.
 *
 * HanziJS ships its dictionaries as plain `.js` files under `hanzi/lib/data/`.
 * We read those files directly (they are template literals / exported arrays),
 * which means the path has to be a real filesystem path. `require.resolve()`
 * cannot be trusted here: when `hanzi` is listed in `serverExternalPackages`,
 * Turbopack returns an `[externals]/...` proxy identifier instead of a path.
 * So we walk up from `process.cwd()` looking for the installed package, and only
 * fall back to `require.resolve` when nothing is found on disk.
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

let packageRoot: string | null = null;

function isHanziRoot(candidate: string): boolean {
  return existsSync(path.join(candidate, "lib", "data", "cedict_ts.u8.js"));
}

export function hanziPackageRoot(): string {
  if (packageRoot) return packageRoot;

  let current = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = path.join(current, "node_modules", "hanzi");
    if (isHanziRoot(candidate)) {
      packageRoot = candidate;
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  try {
    const resolved = require.resolve("hanzi/package.json");
    if (!resolved.startsWith("[externals]")) {
      const root = path.dirname(resolved);
      if (isHanziRoot(root)) {
        packageRoot = root;
        return root;
      }
    }
  } catch {
    // ignored — the error below explains the situation
  }

  throw new Error(
    "Could not locate the `hanzi` package data files. Run `npm install` in the project root.",
  );
}

export function hanziDataFile(file: string): string {
  return path.join(hanziPackageRoot(), "lib", "data", file);
}
