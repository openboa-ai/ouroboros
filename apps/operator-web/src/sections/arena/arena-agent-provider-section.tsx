import { Button } from "@/components/ui/button";
import {
  OPERATOR_DESIGN_TOKENS,
  OperatorActionRow,
  OperatorField,
  OperatorPanel,
  OperatorSectionHeader
} from "@/design-system";

export type ArenaResearcherProviderKind = "codex" | "fixture";

export interface ArenaAgentProviderProfile {
  id: string;
  label: string;
  value: string;
}

export interface ArenaAgentProviderOption {
  provider: string;
  selectableProvider?: ArenaResearcherProviderKind;
  selected: boolean;
  disabled: boolean;
}

export function ArenaAgentProviderSection({
  researcher,
  selectedStatus,
  available,
  failure,
  profiles,
  providerOptions,
  setupDisabled,
  probeDisabled,
  loginDisabled,
  onSelectProvider,
  onSetup,
  onProbe,
  onLogin
}: {
  researcher: string;
  selectedStatus: string;
  available: string;
  failure?: string;
  profiles: ArenaAgentProviderProfile[];
  providerOptions: ArenaAgentProviderOption[];
  setupDisabled: boolean;
  probeDisabled: boolean;
  loginDisabled: boolean;
  onSelectProvider?: (provider: ArenaResearcherProviderKind) => void;
  onSetup?: () => void;
  onProbe?: () => void;
  onLogin?: () => void;
}) {
  return (
    <OperatorPanel aria-label="Agent provider status">
      <OperatorSectionHeader
        title="Agent providers"
        description="Research provider status and local setup controls."
      />
      <dl className={OPERATOR_DESIGN_TOKENS.layout.fieldGrid}>
        <OperatorField label="Researcher" value={researcher} />
        <OperatorField label="Selected status" value={selectedStatus} />
        <OperatorField label="Available" value={available} />
        {failure && <OperatorField label="Failure" value={failure} />}
        {profiles.map((profile) => (
          <OperatorField key={profile.id} label={profile.label} value={profile.value} />
        ))}
      </dl>
      <OperatorActionRow>
        {providerOptions.map((option) => (
          <Button
            key={option.provider}
            type="button"
            variant={option.selected ? "secondary" : "outline"}
            size="sm"
            onClick={() => option.selectableProvider
              ? onSelectProvider?.(option.selectableProvider)
              : undefined}
            disabled={option.disabled || !onSelectProvider || !option.selectableProvider}
          >
            {option.provider}
          </Button>
        ))}
      </OperatorActionRow>
      <OperatorActionRow>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSetup}
          disabled={setupDisabled || !onSetup}
        >
          Setup
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onProbe}
          disabled={probeDisabled || !onProbe}
        >
          Probe
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onLogin}
          disabled={loginDisabled || !onLogin}
        >
          Login
        </Button>
      </OperatorActionRow>
    </OperatorPanel>
  );
}
