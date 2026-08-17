import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, sessionCookieOptions } from "./auth";

const request = { protocol: "https", secure: true, headers: {} } as any;

describe("self-hosted authentication helpers", () => {
  it("hashes passwords with a salted scrypt encoding and verifies them", async () => {
    const encoded = await hashPassword("correct horse battery staple");
    expect(encoded.startsWith("scrypt$")).toBe(true);
    expect(encoded).not.toContain("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", encoded)).toBe(true);
    expect(await verifyPassword("wrong password", encoded)).toBe(false);
  });

  it("uses an httpOnly secure same-site session cookie in HTTPS deployments", () => {
    expect(sessionCookieOptions(request)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  });
});
