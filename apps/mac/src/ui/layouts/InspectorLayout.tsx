import type { ReactNode, RefObject } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/ui/primitives/sheet";
import "./inspector.css";
/** UX: ../../../../../docs/design/UI_PURPOSE_CONTRACT.md#l-07 — one detail surface and one focus-return contract. */
export function InspectorLayout({
  open,
  title,
  description,
  backLabel,
  onBack,
  onClose,
  opener,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  backLabel: string;
  onBack: () => void;
  onClose: () => void;
  opener: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        className="evidence-sheet"
        showCloseButton={false}
        finalFocus={opener}
      >
        <div className="inspector-navigation">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={14} />
            {backLabel}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close details"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
