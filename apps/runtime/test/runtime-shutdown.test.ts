import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { installRuntimeShutdownHandlers } from "../src/runtime-shutdown";

describe("runtime shutdown handlers", () => {
  it("closes the server once when termination signals race", async () => {
    const processEvents = new EventEmitter();
    const close = vi.fn(async () => undefined);
    const handlers = installRuntimeShutdownHandlers({ close }, {
      once: processEvents.once.bind(processEvents),
      off: processEvents.off.bind(processEvents),
      exit: vi.fn(),
      exitCode: null
    });

    processEvents.emit("SIGTERM");
    processEvents.emit("SIGINT");
    await handlers.drain();

    expect(close).toHaveBeenCalledOnce();
    handlers.dispose();
  });

  it("records a failing graceful close as a non-zero process exit", async () => {
    const processEvents = new EventEmitter();
    const runtimeProcess = {
      once: processEvents.once.bind(processEvents),
      off: processEvents.off.bind(processEvents),
      exit: vi.fn(),
      exitCode: null as number | null
    };
    const error = vi.fn();
    const handlers = installRuntimeShutdownHandlers({
      async close() {
        throw new Error("drain failed");
      },
      log: { error }
    }, runtimeProcess);

    processEvents.emit("SIGTERM");
    await handlers.drain();

    expect(runtimeProcess.exitCode).toBe(1);
    expect(runtimeProcess.exit).toHaveBeenCalledOnce();
    expect(runtimeProcess.exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledOnce();
    handlers.dispose();
  });
});
