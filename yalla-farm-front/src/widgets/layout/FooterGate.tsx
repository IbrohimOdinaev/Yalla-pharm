"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/widgets/layout/Footer";

type FooterGateProps = {
  hideFooter?: boolean;
};

export function FooterGate({ hideFooter }: FooterGateProps) {
  const pathname = usePathname();

  if (hideFooter || pathname !== "/") return null;
  return <Footer />;
}
