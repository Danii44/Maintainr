import { describe, expect, it } from "vitest";
import { completionMutationError, statusMutationError } from "../shared/ticketMutationRules";

describe("ticket mutation guards", () => {
  it("rejects status changes across organizations", () => {
    expect(statusMutationError({ actorRole: "PROPERTY_MANAGER", actorId: 10, organizationId: 1, ticketOrganizationId: 2, submittedById: 20, assignedToId: 30, from: "OPEN", to: "ASSIGNED" })).toBe("Ticket not found in your organization");
  });

  it("rejects direct RESOLVED and invalid lifecycle bypasses", () => {
    const base = { actorRole: "PROPERTY_MANAGER" as const, actorId: 10, organizationId: 1, ticketOrganizationId: 1, submittedById: 20, assignedToId: 30 };
    expect(statusMutationError({ ...base, from: "IN_PROGRESS", to: "RESOLVED" })).toContain("technician completion");
    expect(statusMutationError({ ...base, from: "OPEN", to: "CLOSED" })).toBe("Invalid transition from OPEN to CLOSED");
  });

  it("allows only valid RESOLVED-to-CLOSED transition", () => {
    const base = { actorRole: "PROPERTY_MANAGER" as const, actorId: 10, organizationId: 1, ticketOrganizationId: 1, submittedById: 20, assignedToId: 30 };
    expect(statusMutationError({ ...base, from: "RESOLVED", to: "CLOSED" })).toBeNull();
  });

  it("requires proof and notes for technician completion and accepts valid completion", () => {
    const base = { organizationId: 1, ticketOrganizationId: 1, assignedToId: 30, actorId: 30, status: "IN_PROGRESS" };
    expect(completionMutationError({ ...base, proofPhotoUrl: "", resolutionNotes: "fixed" })).toContain("Proof photo");
    expect(completionMutationError({ ...base, proofPhotoUrl: "https://cdn.example/proof.jpg", resolutionNotes: "Replaced the faulty valve" })).toBeNull();
  });

  it("rejects completion when the technician or organization does not match", () => {
    expect(completionMutationError({ organizationId: 1, ticketOrganizationId: 2, assignedToId: 30, actorId: 31, status: "IN_PROGRESS", proofPhotoUrl: "https://cdn.example/proof.jpg", resolutionNotes: "fixed" })).toBe("Assigned ticket not found in your organization");
    expect(completionMutationError({ organizationId: 1, ticketOrganizationId: 1, assignedToId: 30, actorId: 30, status: "OPEN", proofPhotoUrl: "https://cdn.example/proof.jpg", resolutionNotes: "fixed" })).toContain("Only assigned or in-progress");
  });
});
