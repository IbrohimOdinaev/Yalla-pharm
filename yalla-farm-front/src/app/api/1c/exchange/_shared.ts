import { appendFile, mkdir, open, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const exchangeRoot = process.env.ONE_C_EXCHANGE_DIR ?? path.join(process.cwd(), ".data", "1c-exchange");
const sessionCookieName = "yalla_1c_exchange";
const sessionCookieValue = "accepted";
const maxOfferHistory = 3;
const maxImportHistory = 3;
const exchangeStatusFile = ".exchange-status.json";
const receivedFilesInCurrentSession = new Map<string, string>();
const storedFilenameLocks = new Map<string, Promise<string>>();
const sessionStartedAt = new Map<string, number>();

function textResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function xmlResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function getMode(request: NextRequest) {
  return request.nextUrl.searchParams.get("mode")?.toLowerCase() ?? "";
}

function getExchangeType(request: NextRequest) {
  return request.nextUrl.searchParams.get("type")?.toLowerCase() ?? "catalog";
}

function safeFilename(raw: string | null) {
  const value = raw?.trim() || "exchange.xml";
  return path.basename(value).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function safeToken(raw: string | null | undefined) {
  const value = raw?.trim() || "";
  if (!value) {
    return "";
  }

  return path.basename(value).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function sourceTokenFromRequest(request: NextRequest, routeToken?: string) {
  return safeToken(
    routeToken
      ?? request.nextUrl.searchParams.get("sourceToken")
      ?? request.nextUrl.searchParams.get("source")
      ?? request.nextUrl.searchParams.get("token")
  );
}

function sourceDirectory(sourceToken: string) {
  return sourceToken ? path.join(exchangeRoot, sourceToken) : exchangeRoot;
}

function sessionKey(sourceToken: string, filename: string) {
  return `${sourceToken || "_default"}:${filename}`;
}

function isOffersFilename(filename: string) {
  const normalized = filename.toLowerCase();
  return normalized.startsWith("offers") && normalized.endsWith(".xml");
}

function isImportFilename(filename: string) {
  const normalized = filename.toLowerCase();
  return normalized.startsWith("import") && normalized.endsWith(".xml");
}

function buildStoredFilename(filename: string) {
  if (!isOffersFilename(filename) && !isImportFilename(filename)) {
    return filename;
  }

  const extension = path.extname(filename) || ".xml";
  const baseName = path.basename(filename, extension);
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  return `${baseName}.${timestamp}${extension}`;
}

async function ensureExchangeDirectory(sourceToken: string) {
  await mkdir(sourceDirectory(sourceToken), { recursive: true });
}

async function startExchangeSession(sourceToken: string) {
  await ensureExchangeDirectory(sourceToken);
  sessionStartedAt.set(sourceToken || "_default", Date.now());
  const prefix = `${sourceToken || "_default"}:`;
  for (const key of receivedFilesInCurrentSession.keys()) {
    if (key.startsWith(prefix)) {
      receivedFilesInCurrentSession.delete(key);
    }
  }
}

async function recordExchangeStatus(
  sourceToken: string,
  mode: string,
  file?: { filename: string; size: number }
) {
  if (!sourceToken) {
    return;
  }

  try {
    await ensureExchangeDirectory(sourceToken);
    const target = path.join(sourceDirectory(sourceToken), exchangeStatusFile);
    const now = new Date().toISOString();
    const previous = await readExchangeStatus(target);
    const next = {
      ...previous,
      lastContactAtUtc: now,
      lastMode: mode || "unknown",
      lastCheckAuthAtUtc: mode === "checkauth" ? now : previous.lastCheckAuthAtUtc,
      lastInitAtUtc: mode === "init" ? now : previous.lastInitAtUtc,
      lastFileAtUtc: file ? now : previous.lastFileAtUtc,
      lastFilename: file?.filename ?? previous.lastFilename,
      lastFileSize: file?.size ?? previous.lastFileSize
    };
    await writeFile(target, JSON.stringify(next, null, 2));
  } catch {
    // Status is observability only; never break CommerceML exchange because of it.
  }
}

async function readExchangeStatus(target: string): Promise<Record<string, string | number | undefined>> {
  try {
    return JSON.parse(await readFile(target, "utf8"));
  } catch {
    return {};
  }
}

async function saveRequestBody(request: NextRequest, sourceToken: string, filename: string) {
  await ensureExchangeDirectory(sourceToken);
  const storedFilename = await getStoredFilename(sourceToken, filename);
  const bytes = new Uint8Array(await request.arrayBuffer());

  const target = path.join(sourceDirectory(sourceToken), storedFilename);
  if (bytes.length > 0 && (await exists(target))) {
    await appendFile(target, bytes);
  } else {
    await writeFile(target, bytes);
  }
  const info = await stat(target);
  return { target, chunkSize: bytes.length, totalSize: info.size };
}

async function getStoredFilename(sourceToken: string, filename: string) {
  const key = sessionKey(sourceToken, filename);
  const existing = receivedFilesInCurrentSession.get(key);
  if (existing) {
    return existing;
  }

  const pending = storedFilenameLocks.get(key);
  if (pending) {
    return pending;
  }

  const next = resolveStoredFilename(sourceToken, filename)
    .then((storedFilename) => {
      receivedFilesInCurrentSession.set(key, storedFilename);
      return storedFilename;
    })
    .finally(() => {
      storedFilenameLocks.delete(key);
    });

  storedFilenameLocks.set(key, next);
  return next;
}

async function resolveStoredFilename(sourceToken: string, filename: string) {
  if (!isOffersFilename(filename) && !isImportFilename(filename)) {
    return filename;
  }

  const incomplete = await findLatestIncompleteSnapshot(sourceToken, filename);
  return incomplete ?? buildStoredFilename(filename);
}

async function findLatestIncompleteSnapshot(sourceToken: string, filename: string) {
  const directory = sourceDirectory(sourceToken);
  const extension = path.extname(filename) || ".xml";
  const baseName = path.basename(filename, extension);
  const files = await readdir(directory);
  const candidates = await Promise.all(
    files
      .filter((file) => file.startsWith(`${baseName}.`) && file.endsWith(extension))
      .map(async (file) => {
        const fullPath = path.join(directory, file);
        const info = await stat(fullPath);
        return info.isFile() ? { file, fullPath, modifiedAt: info.mtimeMs } : null;
      })
  );

  const latest = candidates
    .filter((file): file is { file: string; fullPath: string; modifiedAt: number } => file != null)
    .sort((a, b) => b.modifiedAt - a.modifiedAt)[0];

  if (!latest) {
    return null;
  }

  const startedAt = sessionStartedAt.get(sourceToken || "_default");
  if (startedAt && latest.modifiedAt < startedAt - 2000) {
    return null;
  }

  const modifiedRecently = Date.now() - latest.modifiedAt < 30 * 60 * 1000;
  if (!modifiedRecently || await isCompleteCommerceXml(latest.fullPath)) {
    return null;
  }

  return latest.file;
}

async function isCompleteCommerceXml(fullPath: string) {
  const info = await stat(fullPath);
  if (!info.isFile() || info.size === 0) {
    return false;
  }

  const tailLength = Math.min(info.size, 8192);
  const file = await open(fullPath, "r");
  try {
    const buffer = Buffer.alloc(tailLength);
    await file.read(buffer, 0, tailLength, info.size - tailLength);
    return buffer.toString("utf8").includes("</КоммерческаяИнформация>");
  } finally {
    await file.close();
  }
}

async function exists(target: string) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function pruneOfferHistory(sourceToken: string) {
  await pruneXmlHistory(sourceToken, isOffersFilename, maxOfferHistory);
}

async function pruneImportHistory(sourceToken: string) {
  await pruneXmlHistory(sourceToken, isImportFilename, maxImportHistory);
}

async function pruneXmlHistory(sourceToken: string, predicate: (filename: string) => boolean, maxHistory: number) {
  await ensureExchangeDirectory(sourceToken);
  const directory = sourceDirectory(sourceToken);
  const files = await readdir(directory);
  const snapshots = await Promise.all(
    files.filter(predicate).map(async (file) => {
      const fullPath = path.join(directory, file);
      const info = await stat(fullPath);
      return { file, fullPath, modifiedAt: info.mtimeMs };
    })
  );

  snapshots.sort((a, b) => b.modifiedAt - a.modifiedAt);
  await Promise.all(snapshots.slice(maxHistory).map((file) => rm(file.fullPath, { force: true })));
}

async function listReceivedFiles(sourceToken: string) {
  await ensureExchangeDirectory(sourceToken);
  const directory = sourceDirectory(sourceToken);
  const files = await readdir(directory);
  const details = await Promise.all(
    files.filter((file) => !file.startsWith(".")).map(async (file) => {
      const fullPath = path.join(directory, file);
      const info = await stat(fullPath);
      if (!info.isFile()) {
        return null;
      }
      return { file, size: info.size, modifiedAt: info.mtime.toISOString() };
    })
  );

  return details
    .filter((file): file is { file: string; size: number; modifiedAt: string } => file != null)
    .sort((a, b) => a.file.localeCompare(b.file));
}

export async function handleOneCGet(request: NextRequest, routeToken?: string) {
  const sourceToken = sourceTokenFromRequest(request, routeToken);
  const mode = getMode(request);
  const type = getExchangeType(request);

  if (mode === "checkauth") {
    await recordExchangeStatus(sourceToken, "checkauth");
    const response = textResponse(`success\n${sessionCookieName}\n${sessionCookieValue}\n`);
    response.cookies.set(sessionCookieName, sessionCookieValue, {
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    });
    return response;
  }

  if (mode === "init") {
    await startExchangeSession(sourceToken);
    await recordExchangeStatus(sourceToken, "init");
    return textResponse("zip=no\nfile_limit=10485760\n");
  }

  if (mode === "import") {
    const filename = safeFilename(request.nextUrl.searchParams.get("filename"));
    await recordExchangeStatus(sourceToken, "import", { filename, size: 0 });
    if (isOffersFilename(filename)) {
      await pruneOfferHistory(sourceToken);
    }
    if (isImportFilename(filename)) {
      await pruneImportHistory(sourceToken);
    }
    return textResponse("success\n");
  }

  if (mode === "query") {
    await recordExchangeStatus(sourceToken, "query");
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?><${type}></${type}>`);
  }

  if (mode === "status" || mode === "") {
    return NextResponse.json({
      ok: true,
      endpoint: sourceToken ? `/api/1c/exchange/${sourceToken}` : "/api/1c/exchange",
      sourceToken: sourceToken || null,
      exchangeType: type,
      files: await listReceivedFiles(sourceToken)
    });
  }

  return textResponse("success\n");
}

export async function handleOneCPost(request: NextRequest, routeToken?: string) {
  const sourceToken = sourceTokenFromRequest(request, routeToken);
  const mode = getMode(request);
  const filename = safeFilename(request.nextUrl.searchParams.get("filename"));

  if (mode === "file" || mode === "" || mode === "import") {
    const saved = await saveRequestBody(request, sourceToken, filename);
    await recordExchangeStatus(sourceToken, "file", { filename, size: saved.totalSize });
    return textResponse(
      `success\nsaved=${path.basename(saved.target)}\nchunk_size=${saved.chunkSize}\ntotal_size=${saved.totalSize}\n`
    );
  }

  return textResponse("success\n");
}
