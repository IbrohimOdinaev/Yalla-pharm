import type { ReactNode } from "react";
import { BottomNav } from "@/widgets/layout/BottomNav";
import { GlobalTopBar } from "@/widgets/layout/GlobalTopBar";
import { ProductModal } from "@/widgets/product/ProductModal";

type AppShellProps = {
  top?: ReactNode;
  children: ReactNode;
  /** Hide the global navigation bar (for admin pages) */
  hideGlobalNav?: boolean;
};

export function AppShell({ top, children, hideGlobalNav }: AppShellProps) {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {!hideGlobalNav ? <GlobalTopBar /> : null}
      {top}
      <main className="mx-auto max-w-screen-2xl px-4 sm:px-8 lg:px-12 pb-6 xs:pb-8 sm:pb-10 pt-3 xs:pt-4 sm:pt-6 overflow-x-hidden">{children}</main>
      <BottomNav />
      <ProductModal />
    </div>
  );
}
