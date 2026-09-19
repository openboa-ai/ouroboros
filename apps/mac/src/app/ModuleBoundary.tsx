import { Component, type ReactNode } from "react";
import { EmptyState } from "@/ui/components/patterns";
/** A domain render failure cannot unmount fixed owner controls or the other destinations. */
export class ModuleBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <EmptyState
        title="This view is unavailable"
        detail="Company navigation and owner controls remain available."
      />
    ) : (
      this.props.children
    );
  }
}
