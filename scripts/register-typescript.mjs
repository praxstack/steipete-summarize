import { statSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreSourceRoot = path.join(repoRoot, "packages", "core", "src");

function resolveTypeScriptPath(candidate) {
  const paths = [
    `${candidate}.ts`,
    `${candidate}.tsx`,
    path.join(candidate, "index.ts"),
    path.join(candidate, "index.tsx"),
  ];
  return paths.find((entry) => statSync(entry, { throwIfNoEntry: false })?.isFile());
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === "@steipete/summarize-core" ||
      specifier.startsWith("@steipete/summarize-core/")
    ) {
      const subpath =
        specifier === "@steipete/summarize-core"
          ? "index"
          : specifier.slice("@steipete/summarize-core/".length);
      const resolved = resolveTypeScriptPath(path.join(coreSourceRoot, subpath));
      if (resolved) return { shortCircuit: true, url: pathToFileURL(resolved).href };
    }

    if (
      context.parentURL?.startsWith(pathToFileURL(repoRoot).href) &&
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      specifier.endsWith(".js")
    ) {
      const candidateUrl = new URL(specifier.replace(/\.js$/, ".ts"), context.parentURL);
      if (statSync(fileURLToPath(candidateUrl), { throwIfNoEntry: false })?.isFile()) {
        return { shortCircuit: true, url: candidateUrl.href };
      }
    }

    return nextResolve(specifier, context);
  },
});
