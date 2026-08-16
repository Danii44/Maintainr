export type AuthPageMode = "sign-in" | "sign-up";
export type OAuthAuthType = "signIn" | "signUp";

export function oauthTypeForMode(mode: AuthPageMode): OAuthAuthType {
  return mode === "sign-up" ? "signUp" : "signIn";
}
