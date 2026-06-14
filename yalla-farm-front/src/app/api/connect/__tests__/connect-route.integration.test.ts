import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/connect/route";

const validPayload = {
  fullName: "Али Вали",
  phone: "992900000000",
  pharmacyName: "Аптека Сино",
  hasOneC: true,
};

describe("/api/connect route", () => {
  const originalIntegrationToken = process.env.TELEGRAM_INTEGRATIONFORM_TOKEN;
  const originalLegacyToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;

  beforeEach(() => {
    process.env.TELEGRAM_INTEGRATIONFORM_TOKEN = "integration-token";
    process.env.TELEGRAM_BOT_TOKEN = "legacy-token";
    process.env.TELEGRAM_CHAT_ID = "chat-1";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
  });

  afterEach(() => {
    process.env.TELEGRAM_INTEGRATIONFORM_TOKEN = originalIntegrationToken;
    process.env.TELEGRAM_BOT_TOKEN = originalLegacyToken;
    process.env.TELEGRAM_CHAT_ID = originalChatId;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sends landing form requests with TELEGRAM_INTEGRATIONFORM_TOKEN", async () => {
    const response = await POST(
      new Request("http://localhost/api/connect", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botintegration-token/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not fall back to TELEGRAM_BOT_TOKEN", async () => {
    delete process.env.TELEGRAM_INTEGRATIONFORM_TOKEN;

    const response = await POST(
      new Request("http://localhost/api/connect", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });
});
