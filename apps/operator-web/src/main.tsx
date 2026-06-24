import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

const maybeRootElement = document.getElementById("root");

if (!maybeRootElement) {
  throw new Error("Ouroboros Operator root element was not found.");
}

const rootElement = maybeRootElement;

function renderFatalError(error: unknown) {
  if (!rootElement) {
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  rootElement.innerHTML = `<main style="font-family: system-ui, sans-serif; padding: 24px; color: #111827;">
    <h1 style="font-size: 20px; margin: 0 0 12px;">Ouroboros Operator failed to render</h1>
    <pre style="white-space: pre-wrap; line-height: 1.5;">${escapeHtml(message)}</pre>
  </main>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

class OperatorRenderBoundary extends Component<
  { children: ReactNode },
  { error?: unknown }
> {
  state: { error?: unknown } = {};

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Ouroboros Operator render failed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const message = this.state.error instanceof Error
        ? this.state.error.message
        : String(this.state.error);
      return (
        <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, color: "#111827" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Ouroboros Operator failed to render</h1>
          <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{message}</pre>
        </main>
      );
    }

    return this.props.children;
  }
}

window.addEventListener("error", (event) => {
  renderFatalError(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  renderFatalError(event.reason);
});

async function boot() {
  const { App } = await import("./App");
  createRoot(rootElement).render(
    <StrictMode>
      <OperatorRenderBoundary>
        <App />
      </OperatorRenderBoundary>
    </StrictMode>
  );
}

void boot().catch(renderFatalError);
