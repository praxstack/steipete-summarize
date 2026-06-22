import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function collectTypeScriptFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(path));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      files.push(path);
    }
  }
  return files;
}

describe("shared runtime ownership", () => {
  it("keeps browser imports within the extension package manifest", () => {
    const extensionRoot = resolve("apps/chrome-extension/src");
    const manifest = JSON.parse(
      readFileSync(resolve("apps/chrome-extension/package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ]);
    const undeclared: string[] = [];
    for (const file of collectTypeScriptFiles(extensionRoot)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
        const specifier = match[1] ?? "";
        if (!specifier || specifier.startsWith(".") || specifier.startsWith("virtual:")) continue;
        const parts = specifier.split("/");
        const packageName = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
        if (packageName && !declared.has(packageName)) {
          undeclared.push(`${relative(process.cwd(), file)}: ${specifier}`);
        }
      }
    }

    expect(undeclared).toEqual([]);
  });

  it("has one streaming SSE framing implementation", () => {
    const definitions = [
      resolve("src"),
      resolve("packages/core/src"),
      resolve("apps/chrome-extension/src"),
    ]
      .flatMap(collectTypeScriptFiles)
      .filter((file) => /\bfunction\*\s+parseSseStream\b/.test(readFileSync(file, "utf8")))
      .map((file) => relative(process.cwd(), file));

    expect(definitions).toEqual(["packages/core/src/runtime/sse-events.ts"]);
  });
});
