import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

process.env.NEXT_PUBLIC_SIGNALR_UPDATES_HUB_URL = "http://localhost/hubs/updates";
process.env.NEXT_PUBLIC_SIGNALR_TELEGRAM_AUTH_HUB_URL = "http://localhost/hubs/telegram-auth";

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  value: vi.fn()
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useParams: () => ({ id: "test-id" }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn()
}));
