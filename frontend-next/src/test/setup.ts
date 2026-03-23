import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

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
    prefetch: vi.fn()
  })
}));
