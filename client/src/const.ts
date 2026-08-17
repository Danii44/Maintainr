/**
 * Compatibility entry point for legacy template components.
 * Maintainr uses self-hosted email/password authentication; no OAuth provider is invoked.
 */
export const startLogin = () => {
  if (typeof window !== "undefined") window.location.assign("/sign-in");
};
