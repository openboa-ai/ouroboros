import { StrictMode } from "react";
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
      <App />
    </StrictMode>
  );
}

void boot().catch(renderFatalError);
