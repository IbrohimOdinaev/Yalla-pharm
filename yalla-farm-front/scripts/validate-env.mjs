#!/usr/bin/env node
// Build-time env-vars validator. Fails the build if a critical Next.js
// public-env variable is missing — better a hard error here than a
// silently broken bundle that 404s every API call in production.
//
// Wired into npm scripts via `prebuild` so it runs automatically before
// `next build`. Skip locally with `SKIP_ENV_VALIDATE=1 npm run build`.

const skip = process.env.SKIP_ENV_VALIDATE === "1";
if (skip) {
  console.log("[validate-env] SKIP_ENV_VALIDATE=1 — skipping.");
  process.exit(0);
}

const errors = [];
const warnings = [];

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
if (!apiBaseUrl) {
  errors.push(
    "NEXT_PUBLIC_API_BASE_URL is empty. Set it to the API host (e.g. https://yalla-pharm-1.onrender.com).",
  );
} else if (!/^https?:\/\//.test(apiBaseUrl)) {
  errors.push(
    `NEXT_PUBLIC_API_BASE_URL must be an absolute URL (got "${apiBaseUrl}").`,
  );
}

if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
  warnings.push(
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is empty. Pharmacy map + address picker will be unavailable.",
  );
}

for (const w of warnings) console.warn(`[validate-env] WARN  ${w}`);

if (errors.length > 0) {
  console.error("[validate-env] FAIL — required env vars are missing:");
  for (const e of errors) console.error(`  • ${e}`);
  process.exit(1);
}

console.log("[validate-env] OK");
