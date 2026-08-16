import { describe, expect, it } from "vitest";
import { canMutateManagerTicket } from "../shared/managerActionRules";

describe("manager ticket actions", () => {
  it("accepts a positive ticket and technician within the same organization", () => {
    expect(canMutateManagerTicket({ ticketId: 42, technicianId: 7, organizationId: 3, ticketOrganizationId: 3 })).toBe(true);
  });

  it("rejects invalid technician IDs", () => {
    expect(canMutateManagerTicket({ ticketId: 42, technicianId: 0, organizationId: 3, ticketOrganizationId: 3 })).toBe(false);
    expect(canMutateManagerTicket({ ticketId: 42, technicianId: -2, organizationId: 3, ticketOrganizationId: 3 })).toBe(false);
  });

  it("rejects cross-organization manager actions", () => {
    expect(canMutateManagerTicket({ ticketId: 42, technicianId: 7, organizationId: 3, ticketOrganizationId: 9 })).toBe(false);
  });
});
