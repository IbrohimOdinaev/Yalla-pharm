import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as search } from "@/app/api/map/mahal/search/route";
import { GET as reverse } from "@/app/api/map/mahal/reverse/route";

const OLD_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("Mahal proxy routes", () => {
  it("returns 503 when Mahal token is not configured", async () => {
    delete process.env.MAHAL_API_TOKEN;
    delete process.env.NEXT_PUBLIC_MAHAL_API_TOKEN;

    const response = await search(new NextRequest("http://localhost/api/map/mahal/search?text=ru"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      message: "MAHAL_API_TOKEN is not configured.",
    });
  });

  it("search calls Mahal getAddress via POST with server token", async () => {
    process.env.MAHAL_API_TOKEN = "server-token";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              latitude: 38.563985,
              longitude: 68.798225,
              type: "poi",
              detailInfo: { name: "Рудаки", categories: "Ресторан" },
              detailAddress: { subject_name: "Душанбе", street_name: "Рудаки" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await search(new NextRequest("http://localhost/api/map/mahal/search?text=ru&limit=1"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual([
      expect.objectContaining({ title: "Рудаки", lat: 38.563985, lng: 68.798225 }),
    ]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://platform.mahal.tj/api/services/getAddress");
    expect(String(url)).toContain("token=server-token");
    expect(options).toMatchObject({ method: "POST" });
  });

  it("reverse returns nearest Mahal address", async () => {
    process.env.MAHAL_API_TOKEN = "server-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                latitude: 38.55975,
                longitude: 68.773903,
                type: "Address",
                detailAddress: {
                  subject_name: "Душанбе",
                  street_type: "гузаргоҳи",
                  street_name: "2-юм Абдулаҳад Қаҳҳоров",
                  number: "4",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const response = await reverse(
      new NextRequest("http://localhost/api/map/mahal/reverse?lat=38.5598&lng=68.7738"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      address: "гузаргоҳи 2-юм Абдулаҳад Қаҳҳоров, 4, Душанбе",
      lat: 38.5598,
      lng: 68.7738,
    });
  });
});
