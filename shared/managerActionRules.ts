export function canMutateManagerTicket(input: {
  ticketId: number;
  organizationId: number | null | undefined;
  ticketOrganizationId: number | null | undefined;
  technicianId?: number;
}) {
  if (!Number.isInteger(input.ticketId) || input.ticketId <= 0) return false;
  if (input.technicianId !== undefined && (!Number.isInteger(input.technicianId) || input.technicianId <= 0)) return false;
  return Boolean(input.organizationId && input.ticketOrganizationId && input.organizationId === input.ticketOrganizationId);
}
