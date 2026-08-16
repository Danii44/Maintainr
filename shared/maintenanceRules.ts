export const ROLES = ["PROPERTY_MANAGER", "TENANT", "TECHNICIAN", "FLAT_OWNER"] as const;
export const STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export const CATEGORIES = ["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "OTHER"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"] as const;

export function isValidUnitAccessCode(code: string) {
  return /^\d{6}$/.test(code);
}

export function canMarkResolved(input: { proofPhotoUrl?: string | null; resolutionNotes?: string | null }) {
  return Boolean(input.proofPhotoUrl?.trim()) && Boolean(input.resolutionNotes?.trim());
}

const allowedTransitions: Record<string, string[]> = {
  OPEN: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS", "OPEN"],
  IN_PROGRESS: ["ASSIGNED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export function canTransitionStatus(from: string, to: string) {
  return allowedTransitions[from]?.includes(to) ?? false;
}
