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
  rootElement.innerHTML = `<main aria-label="Ouroboros Operator render failure" style="min-height: 100vh; display: grid; place-items: center; box-sizing: border-box; padding: 24px; background: #F8F7F5; color: #17120F; font-family: Inter, ui-sans-serif, system-ui, sans-serif;">
    <section style="width: min(100%, 720px); border-top: 4px solid #F37021; padding-top: 20px;">
      <p style="margin: 0 0 8px; color: #F37021; font-size: 12px; font-weight: 700;">Ouroboros</p>
      <h1 style="margin: 0 0 12px; font-size: 20px; line-height: 1.3;">Operator failed to render</h1>
      <pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; color: #57534E; font-size: 14px; line-height: 1.5;">${escapeHtml(message)}</pre>
    </section>
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
        <main
          aria-label="Ouroboros Operator render failure"
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            boxSizing: "border-box",
            padding: 24,
            background: "#F8F7F5",
            color: "#17120F",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
          }}
        >
          <section style={{ width: "min(100%, 720px)", borderTop: "4px solid #F37021", paddingTop: 20 }}>
            <p style={{ margin: "0 0 8px", color: "#F37021", fontSize: 12, fontWeight: 700 }}>
              Ouroboros
            </p>
            <h1 style={{ margin: "0 0 12px", fontSize: 20, lineHeight: 1.3 }}>
              Operator failed to render
            </h1>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                color: "#57534E",
                fontSize: 14,
                lineHeight: 1.5
              }}
            >
              {message}
            </pre>
          </section>
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
