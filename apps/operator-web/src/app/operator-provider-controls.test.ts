import { describe, expect, it } from "vitest";
import { providerControlAvailability } from "./operator-provider-controls";

describe("providerControlAvailability", () => {
  it("offers setup only for an unconfigured provider", () => {
    expect(providerControlAvailability("not_configured", false)).toEqual({
      canSetup: true,
      canProbe: false,
      canLogin: false,
      canSelect: false
    });
  });

  it("keeps unsupported providers inert", () => {
    expect(providerControlAvailability("unsupported", false)).toEqual({
      canSetup: false,
      canProbe: false,
      canLogin: false,
      canSelect: false
    });
  });

  it("allows authenticated providers to be probed or selected without resetting them", () => {
    expect(providerControlAvailability("authenticated", false)).toEqual({
      canSetup: false,
      canProbe: true,
      canLogin: false,
      canSelect: true
    });
    expect(providerControlAvailability("authenticated", true).canSelect).toBe(false);
  });

  it("offers recovery actions while selection remains closed", () => {
    expect(providerControlAvailability("login_required", false)).toEqual({
      canSetup: false,
      canProbe: true,
      canLogin: true,
      canSelect: false
    });
    expect(providerControlAvailability("unavailable", false)).toEqual({
      canSetup: false,
      canProbe: true,
      canLogin: true,
      canSelect: false
    });
  });
});
