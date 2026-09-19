import type { ReactNode } from "react";
import { Badge } from "@/ui/primitives/badge";
export function Status({ children }: { children: ReactNode }) {
  return (
    <Badge variant="secondary" className="status-badge">
      {children}
    </Badge>
  );
}
