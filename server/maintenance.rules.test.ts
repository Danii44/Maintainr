import { describe, expect, it } from "vitest";
import { canMarkResolved, canTransitionStatus, isValidUnitAccessCode } from "../shared/maintenanceRules";

describe("maintenance business rules", () => {
  it("accepts only exactly six numeric unit access code digits", () => {
    expect(isValidUnitAccessCode("123456")).toBe(true);
    expect(isValidUnitAccessCode("12345")).toBe(false);
    expect(isValidUnitAccessCode("1234567")).toBe(false);
    expect(isValidUnitAccessCode("12A456")).toBe(false);
  });

  it("enforces the ticket lifecycle sequence", () => {
    expect(canTransitionStatus("OPEN", "ASSIGNED")).toBe(true);
    expect(canTransitionStatus("ASSIGNED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionStatus("RESOLVED", "CLOSED")).toBe(true);
    expect(canTransitionStatus("IN_PROGRESS", "CLOSED")).toBe(false);
    expect(canTransitionStatus("CLOSED", "RESOLVED")).toBe(false);
    expect(canTransitionStatus("OPEN", "RESOLVED")).toBe(false);
    expect(canTransitionStatus("CLOSED", "IN_PROGRESS")).toBe(false);
  });

  it("requires proof photo and resolution notes before resolving", () => {
    expect(canMarkResolved({})).toBe(false);
    expect(canMarkResolved({ proofPhotoUrl: "proof.jpg" })).toBe(false);
    expect(canMarkResolved({ resolutionNotes: "Replaced filter" })).toBe(false);
    expect(canMarkResolved({ proofPhotoUrl: "proof.jpg", resolutionNotes: "Replaced filter" })).toBe(true);
    expect(canMarkResolved({ proofPhotoUrl: "  ", resolutionNotes: "Replaced filter" })).toBe(false);
  });
});
