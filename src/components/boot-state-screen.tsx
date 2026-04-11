import { Button } from "./ui/button";
import { Card } from "./ui/card";

type BootStateScreenProps = {
  error: string | null;
  onRetry: () => void | Promise<void>;
};

export function BootStateScreen({ error, onRetry }: BootStateScreenProps) {
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-shell-950 px-6 text-ink-50">
        <Card
          title="AutoKairos failed to boot"
          description="The client could not load the workspace through the service boundary."
          className="w-full max-w-xl"
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-ink-200">{error}</p>
            <Button
              variant="secondary"
              onClick={() => {
                void onRetry();
              }}
            >
              Retry bootstrap
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-shell-950 text-ink-50">
      <div className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-[0.24em] text-ink-300">AutoKairos</p>
        <p className="text-lg text-ink-50">Booting trading workspace...</p>
      </div>
    </main>
  );
}
