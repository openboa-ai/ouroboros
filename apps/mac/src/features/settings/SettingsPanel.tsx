import { Monitor, Sun, Moon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/ui/primitives/button";
import { Facts } from "@/ui/components/patterns";
import { DetailSection } from "@/ui/components/DetailSection";
import { useTheme } from "@/ui/components/theme-provider";
/** UX S-10: local appearance preferences are separate from company authority and operations. */
export function SettingsPanel({ connectionActions }: { connectionActions?: ReactNode }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="inspector-content">
      <DetailSection title="Appearance" note="Saved on this Mac">
        <div className="settings-options" role="group" aria-label="Appearance">
          {(
            [
              { id: "system", name: "System", icon: Monitor },
              { id: "light", name: "Light", icon: Sun },
              { id: "dark", name: "Dark", icon: Moon },
            ] as const
          ).map((t) => (
            <Button
              key={t.id}
              variant={theme === t.id ? "secondary" : "ghost"}
              aria-pressed={theme === t.id}
              onClick={() => setTheme(t.id)}
            >
              <t.icon size={16} />
              {t.name}
            </Button>
          ))}
        </div>
      </DetailSection>
      {connectionActions && <DetailSection title="Company connection" note="Choose which operating environment this app observes.">{connectionActions}</DetailSection>}
      <DetailSection title="Window & operation">
        <Facts
          rows={[
            ["Close window", "Hide the app; company operation is separate"],
            ["Login launch", "Not configured"],
            ["System notifications", "Not connected"],
            ["Reduced motion", "Follows macOS preference"],
          ]}
        />
      </DetailSection>
      <DetailSection title="Keyboard">
        <Facts
          rows={[
            ["Search company records", "⌘ K"],
            ["Close detail", "Esc"],
            ["Move between controls", "Tab / Shift Tab"],
          ]}
        />
      </DetailSection>
      <DetailSection title="About">
        <Facts
          rows={[
            ["Application", "Ouroboros · 0.1.0 development"],
            ["Design system", "OpenBoa · shadcn Mira / Base UI"],
            ["Storage", "Local appearance and reconnect references"],
            ["Company records", "Owned by the operating environment"],
          ]}
        />
      </DetailSection>
    </div>
  );
}
