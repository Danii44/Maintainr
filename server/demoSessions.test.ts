import { describe, expect, it } from "vitest";
import { createDemoSession, createDemoSessionToken, publicDemoRegistrationEnabled } from "./demoSessions";

describe("demo session safeguards", () => {
  it("creates high-entropy distinct server-side tokens", () => {
    const first = createDemoSessionToken();
    const second = createDemoSessionToken();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
  });

  it("keeps public demo creation disabled unless explicitly enabled", () => {
    const original = process.env.DEMO_PUBLIC_REGISTRATION_ENABLED;
    delete process.env.DEMO_PUBLIC_REGISTRATION_ENABLED;
    expect(publicDemoRegistrationEnabled()).toBe(false);
    process.env.DEMO_PUBLIC_REGISTRATION_ENABLED = "true";
    expect(publicDemoRegistrationEnabled()).toBe(true);
    if (original === undefined) delete process.env.DEMO_PUBLIC_REGISTRATION_ENABLED;
    else process.env.DEMO_PUBLIC_REGISTRATION_ENABLED = original;
  });

  it("does not create a database-backed demo session while public registration is disabled", async () => {
    const original = process.env.DEMO_PUBLIC_REGISTRATION_ENABLED;
    delete process.env.DEMO_PUBLIC_REGISTRATION_ENABLED;
    await expect(createDemoSession("127.0.0.1")).rejects.toThrow("Public demo registration is not enabled");
    if (original === undefined) delete process.env.DEMO_PUBLIC_REGISTRATION_ENABLED;
    else process.env.DEMO_PUBLIC_REGISTRATION_ENABLED = original;
  });
});
