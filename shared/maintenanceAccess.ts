export type MaintenanceRole = "PROPERTY_MANAGER" | "TENANT" | "TECHNICIAN" | "FLAT_OWNER";

export function canAccessPortal(userRole: MaintenanceRole | null | undefined, portalRole: MaintenanceRole) {
  return Boolean(userRole && userRole === portalRole);
}
