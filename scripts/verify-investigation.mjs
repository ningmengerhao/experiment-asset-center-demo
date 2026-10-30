import assert from "node:assert/strict";
import fs from "node:fs";
import { computeStaticFingerprint } from "./build-static.mjs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const analysis = fs.readFileSync("src/anomaly-analysis.mjs", "utf8");
const routing = fs.readFileSync("src/investigation.mjs", "utf8");
const dist = fs.readFileSync("dist/index.html", "utf8");

assert.match(analysis, /function detectEffectInversion/);
assert.match(analysis, /consecutiveWindows >= 2/);
assert.match(analysis, /event\.pValue < 0\.05/);
assert.match(analysis, /score >= 80/);
assert.match(analysis, /signals\.sampleOverlap >= 0\.7/);
assert.match(analysis, /signals\.rolloutAlignment >= 0\.7/);
assert.match(analysis, /signals\.layerOverlap >= 0\.6 \|\| signals\.metricSync >= 0\.7/);
assert.match(analysis, /function projectCandidateVerification/);
assert.match(analysis, /disclosure: "identified"/);
assert.match(analysis, /displayName: verification\.experimentId/);
assert.match(analysis, /owner: verification\.owner/);
assert.match(analysis, /function createCollaborationNotice/);
assert.match(app, /function runEffectAnalysis/);
assert.match(app, /analysisCases/);
assert.match(app, /collaborationNotices/);
assert.match(routing, /"case"/);
assert.match(dist, new RegExp(`experiment-static-fingerprint" content="${computeStaticFingerprint()}`));
console.log("Effect-inversion static verification passed.");
