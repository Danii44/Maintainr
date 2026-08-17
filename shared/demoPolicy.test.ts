import { describe, expect, it } from "vitest";
import { canEnablePublicDemoRegistration, STATIC_DEMO_PREVIEW_POLICY } from "./demoPolicy";

describe("demo environment policy", () => {
  it("keeps the current interactive preview disconnected from customer data and public demo registration", () => {
    expect(STATIC_DEMO_PREVIEW_POLICY.permitsProductionData).toBe(false);
    expect(STATIC_DEMO_PREVIEW_POLICY.permitsExternalDelivery).toBe(false);
    expect(STATIC_DEMO_PREVIEW_POLICY.persistsVisitorData).toBe(false);
    expect(STATIC_DEMO_PREVIEW_POLICY.publicRegistrationEnabled).toBe(false);
    expect(canEnablePublicDemoRegistration(STATIC_DEMO_PREVIEW_POLICY)).toBe(false);
  });

  it("requires dedicated persistence and disabled production/external actions before registration can be enabled", () => {
    expect(canEnablePublicDemoRegistration({
      hasDedicatedDatabase: true,
      hasDedicatedStorage: true,
      permitsProductionData: false,
      permitsExternalDelivery: false,
      persistsVisitorData: true,
      publicRegistrationEnabled: false,
    })).toBe(true);
  });
});
