import { startTransition, useEffect, useState } from "react";

type UseServiceResourceParams<T> = {
  enabled: boolean;
  loader: () => Promise<T>;
  deps: readonly unknown[];
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useServiceResource<T>({
  enabled,
  loader,
  deps
}: UseServiceResourceParams<T>) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      startTransition(() => {
        setValue(null);
        setError(null);
      });
      return;
    }

    let cancelled = false;
    startTransition(() => {
      setValue(null);
      setError(null);
    });

    void (async () => {
      try {
        const nextValue = await loader();
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setValue(nextValue);
        });
      } catch (nextError) {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setError(errorMessage(nextError));
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, ...deps]);

  return {
    value,
    error
  };
}
