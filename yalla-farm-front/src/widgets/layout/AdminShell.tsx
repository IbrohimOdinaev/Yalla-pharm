import type { ReactNode } from "react";
import { StaffShell } from "./StaffShell";

export function AdminShell({ children, top }: { children: ReactNode; top?: ReactNode }) {
  return (
    <StaffShell>
      {top}
      {children}
    </StaffShell>
  );
}
