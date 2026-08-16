import { describe, expect, it } from "vitest";
import { oauthTypeForMode } from "../shared/authFlow";

describe("authentication entry flow", () => {
  it("maps sign-in to the signIn OAuth mode", () => {
    expect(oauthTypeForMode("sign-in")).toBe("signIn");
  });

  it("maps sign-up to the signUp OAuth mode", () => {
    expect(oauthTypeForMode("sign-up")).toBe("signUp");
  });
});
