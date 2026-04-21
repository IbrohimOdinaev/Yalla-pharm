import type { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { BottomNav } from "./BottomNav";

export function AdminShell({ children, top }: { children: ReactNode; top?: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {top}
        <main className="flex-1 py-4 pb-24 sm:py-6 lg:pb-6">
          <div className="mx-auto w-[90%]">{children}</div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
