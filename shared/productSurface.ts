export const PUBLIC_SURFACE_PATHS = {
  marketing: "/",
  interactiveDemo: "/demo",
  workspaceCreation: "/create-workspace",
  signIn: "/sign-in",
} as const;

export function isPublicProductSurface(pathname: string) {
  return pathname === PUBLIC_SURFACE_PATHS.marketing || pathname === PUBLIC_SURFACE_PATHS.interactiveDemo;
}
