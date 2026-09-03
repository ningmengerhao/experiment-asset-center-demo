import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

export const STATIC_GENERATOR_VERSION = "2";
export const STATIC_FINGERPRINT_FILES = [
  "src/main.tsx",
  "src/App.tsx",
  "src/styles.css",
  "src/investigation.mjs",
  "src/investigation.d.mts",
  "src/create-experiment.mjs",
  "src/create-experiment.d.mts",
  "src/demo-access.mjs",
  "src/demo-access.d.mts",
  "src/drawer.mjs",
  "src/drawer.d.mts",
  "src/monitoring.mjs",
  "src/monitoring.d.mts",
];

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(scriptDirectory, "..");

export function computeStaticFingerprint(root = projectRoot) {
  const hash = crypto.createHash("sha256");
  hash.update(`experiment-asset-static:${STATIC_GENERATOR_VERSION}\n`, "utf8");
  for (const sourceFile of STATIC_FINGERPRINT_FILES) {
    hash.update(`${sourceFile}\0`, "utf8");
    hash.update(fs.readFileSync(path.join(root, sourceFile)));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function escapeInlineContent(content, tagName) {
  return content.replace(new RegExp(`</${tagName}`, "gi"), `<\\/${tagName}`);
}

export function classifyOutputs(outputFiles) {
  if (!Array.isArray(outputFiles) || outputFiles.length !== 2) {
    throw new Error("Static build must emit exactly two outputs: one JavaScript bundle and one CSS bundle.");
  }
  const jsOutputs = outputFiles.filter((file) => file.path.endsWith(".js"));
  const cssOutputs = outputFiles.filter((file) => file.path.endsWith(".css"));
  if (jsOutputs.length !== 1 || cssOutputs.length !== 1) {
    throw new Error("Static build must emit exactly one JavaScript bundle and one CSS bundle.");
  }
  return {
    script: Buffer.from(jsOutputs[0].contents).toString("utf8"),
    style: Buffer.from(cssOutputs[0].contents).toString("utf8"),
  };
}

export function createStaticHtml({ script, style, fingerprint }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="experiment-static-fingerprint" content="${fingerprint}">
  <title>实验资产中心</title>
  <style>${escapeInlineContent(style, "style")}</style>
</head>
<body>
  <div id="root"></div>
  <script>${escapeInlineContent(script, "script")}</script>
</body>
</html>
`;
}

export async function generateStaticHtml(root = projectRoot) {
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [path.join(root, "src", "main.tsx")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    write: false,
    outdir: path.join(root, ".static-build"),
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    charset: "utf8",
    define: { "process.env.NODE_ENV": "\"production\"" },
  });
  const { script, style } = classifyOutputs(result.outputFiles);
  return createStaticHtml({ script, style, fingerprint: computeStaticFingerprint(root) });
}

function writeStaticArtifact(distFile, html) {
  const outputDirectory = path.dirname(distFile);
  const tempFile = path.join(outputDirectory, `.${path.basename(distFile)}.${process.pid}.${Date.now()}.tmp`);
  fs.mkdirSync(outputDirectory, { recursive: true });
  try {
    fs.writeFileSync(tempFile, html, "utf8");
    fs.renameSync(tempFile, distFile);
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const html = await generateStaticHtml();
  const distFile = path.join(projectRoot, "dist", "index.html");
  if (checkOnly) {
    const current = fs.readFileSync(distFile, "utf8");
    if (current !== html) {
      throw new Error("Static artifact is out of date. Run: npm run build:static");
    }
    console.log("Static artifact is current.");
    return;
  }
  writeStaticArtifact(distFile, html);
  console.log("Static artifact generated: dist/index.html");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
