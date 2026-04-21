import type { ReactNode } from "react";
import { BottomNav } from "@/widgets/layout/BottomNav";
import { GlobalTopBar } from "@/widgets/layout/GlobalTopBar";
import { Footer } from "@/widgets/layout/Footer";
import { ProductModal } from "@/widgets/product/ProductModal";

type AppShellProps = {
  top?: ReactNode;
  children: ReactNode;
  /** Hide the global navigation bar (for admin pages) */
  hideGlobalNav?: boolean;
  /** Hide the desktop footer (for focused flows like checkout) */
  hideFooter?: boolean;
  /** Make main narrower — good for article-like pages (profile, checkout) */
  narrow?: boolean;
};

export function AppShell({ top, children, hideGlobalNav, hideFooter, narrow }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      {!hideGlobalNav ? <GlobalTopBar /> : null}
      {top}
      <main
        className={`mx-auto w-[90%] flex-1 pb-24 pt-3 xs:pt-4 sm:pt-6 overflow-x-hidden ${
          narrow ? "max-w-3xl" : ""
        }`}
      >
        {children}
      </main>
      {!hideFooter ? <Footer /> : null}
      <BottomNav />
      <ProductModal />
    </div>
  );
}
