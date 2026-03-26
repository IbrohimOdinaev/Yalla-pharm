import type { ReactNode } from "react";
import { BottomNav } from "@/widgets/layout/BottomNav";

type AppShellProps = {
  top: ReactNode;
  children: ReactNode;
};

export function AppShell({ top, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {top}
      <main className="mx-auto max-w-5xl px-3 pb-28 pt-4 sm:px-4 sm:pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
