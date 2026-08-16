import { describe, expect, it } from "vitest";
import { canAccessPortal } from "../shared/maintenanceAccess";

describe("maintenance portal access", () => {
  it("allows a user to access only the matching portal", () => {
    expect(canAccessPortal("PROPERTY_MANAGER", "PROPERTY_MANAGER")).toBe(true);
    expect(canAccessPortal("TENANT", "PROPERTY_MANAGER")).toBe(false);
    expect(canAccessPortal("TECHNICIAN", "FLAT_OWNER")).toBe(false);
  });

  it("rejects missing roles", () => {
    expect(canAccessPortal(null, "TENANT")).toBe(false);
    expect(canAccessPortal(undefined, "TECHNICIAN")).toBe(false);
  });
});
