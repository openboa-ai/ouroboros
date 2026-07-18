import type { AgentProfileStatus } from "@ouroboros/domain";

export interface ProviderControlAvailability {
  canSetup: boolean;
  canProbe: boolean;
  canLogin: boolean;
  canSelect: boolean;
}

export function providerControlAvailability(
  status: AgentProfileStatus,
  selected: boolean
): ProviderControlAvailability {
  switch (status) {
    case "not_configured":
      return { canSetup: true, canProbe: false, canLogin: false, canSelect: false };
    case "configured":
    case "login_required":
    case "unavailable":
      return { canSetup: false, canProbe: true, canLogin: true, canSelect: false };
    case "authenticated":
      return { canSetup: false, canProbe: true, canLogin: false, canSelect: !selected };
    case "unsupported":
      return { canSetup: false, canProbe: false, canLogin: false, canSelect: false };
  }
}
