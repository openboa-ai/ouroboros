type RuntimeSignal = "SIGINT" | "SIGTERM";

interface RuntimeShutdownServer {
  close(): Promise<unknown>;
  log?: Pick<Console, "error">;
}

interface RuntimeProcessSignalPort {
  once(signal: RuntimeSignal, listener: () => void): unknown;
  off(signal: RuntimeSignal, listener: () => void): unknown;
  exit(code: number): unknown;
  exitCode: string | number | null | undefined;
}

export function installRuntimeShutdownHandlers(
  server: RuntimeShutdownServer,
  runtimeProcess: RuntimeProcessSignalPort = process
) {
  let closing: Promise<void> | undefined;
  let hardExitRequested = false;
  const shutdown = (): Promise<void> => {
    closing ??= server.close()
      .then(() => undefined)
      .catch((error: unknown) => {
        runtimeProcess.exitCode = 1;
        server.log?.error(error);
        throw error;
      });
    return closing;
  };
  const handleSignal = (): void => {
    void shutdown().catch(() => {
      if (hardExitRequested) return;
      hardExitRequested = true;
      runtimeProcess.exit(1);
    });
  };
  const listeners = new Map<RuntimeSignal, () => void>([
    ["SIGINT", handleSignal],
    ["SIGTERM", handleSignal]
  ]);
  for (const [signal, listener] of listeners) {
    runtimeProcess.once(signal, listener);
  }
  return {
    shutdown,
    async drain(): Promise<void> {
      await closing?.catch(() => undefined);
    },
    dispose(): void {
      for (const [signal, listener] of listeners) {
        runtimeProcess.off(signal, listener);
      }
    }
  };
}
