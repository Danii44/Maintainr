import { canMarkResolved, canTransitionStatus } from "./maintenanceRules";

export type TicketMutationActor = "PROPERTY_MANAGER" | "TENANT" | "TECHNICIAN";

export type StatusMutationInput = {
  actorRole: TicketMutationActor;
  actorId: number;
  organizationId: number | null | undefined;
  ticketOrganizationId: number | null | undefined;
  submittedById: number | null | undefined;
  assignedToId: number | null | undefined;
  from: string;
  to: string;
};

export function statusMutationError(input: StatusMutationInput): string | null {
  if (!input.organizationId || input.ticketOrganizationId !== input.organizationId) return "Ticket not found in your organization";
  if (input.to === "RESOLVED") return "Use technician completion with proof and notes to resolve tickets";
  if (input.actorRole === "TENANT" && input.submittedById !== input.actorId) return "Tenant can only update their own ticket";
  if (input.actorRole === "TECHNICIAN" && input.assignedToId !== input.actorId) return "Technician is not assigned to this ticket";
  if (!canTransitionStatus(input.from, input.to)) return `Invalid transition from ${input.from} to ${input.to}`;
  return null;
}

export type CompletionMutationInput = {
  organizationId: number | null | undefined;
  ticketOrganizationId: number | null | undefined;
  assignedToId: number | null | undefined;
  actorId: number;
  status: string;
  proofPhotoUrl: string | null | undefined;
  resolutionNotes: string | null | undefined;
};

export function completionMutationError(input: CompletionMutationInput): string | null {
  if (!input.organizationId || input.ticketOrganizationId !== input.organizationId || input.assignedToId !== input.actorId) return "Assigned ticket not found in your organization";
  if (input.status !== "IN_PROGRESS" && input.status !== "ASSIGNED") return "Only assigned or in-progress tickets can be resolved";
  if (!canMarkResolved({ proofPhotoUrl: input.proofPhotoUrl, resolutionNotes: input.resolutionNotes })) return "Proof photo and resolution notes are required";
  return null;
}
