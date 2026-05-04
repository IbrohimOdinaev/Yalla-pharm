#!/usr/bin/env node
// Build-time env-vars validator. Fails the build if a critical env
// variable is missing — better a hard error here than a silently broken
// bundle that 404s every API call in production.
//
// Two valid networking modes (the front supports both):
//   1. Server-side rewrites (recommended for Vercel + Render):
//      INTERNAL_API_URL=https://api.example.com → next.config.ts proxies
//      /api/* and /hubs/* server-side. Browser uses relative URLs, so
//      no CORS is triggered and no public env var is required.
//   2. Direct cross-origin: NEXT_PUBLIC_API_BASE_URL=https://api…
//      bakes the absolute API host into the client bundle. Requires the
//      backend's Cors:AllowedOrigins to list the front's origin.
// At least one of the two MUST be set; both being set is fine — the
// public var wins (`http-client.ts` prefixes every request with it).
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

const publicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const internalApiUrl = process.env.INTERNAL_API_URL ?? "";

if (publicApiBaseUrl && !/^https?:\/\//.test(publicApiBaseUrl)) {
  errors.push(
    `NEXT_PUBLIC_API_BASE_URL must be an absolute URL (got "${publicApiBaseUrl}").`,
  );
}

if (internalApiUrl && !/^https?:\/\//.test(internalApiUrl)) {
  errors.push(
    `INTERNAL_API_URL must be an absolute URL (got "${internalApiUrl}").`,
  );
}

if (!publicApiBaseUrl && !internalApiUrl) {
  errors.push(
    "Neither INTERNAL_API_URL nor NEXT_PUBLIC_API_BASE_URL is set. Set INTERNAL_API_URL=<api-host> for server-side rewrites (recommended), or NEXT_PUBLIC_API_BASE_URL for direct cross-origin calls.",
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
