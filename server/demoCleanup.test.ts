import { describe, expect, it } from "vitest";
import { DEMO_SESSION_CLEANUP_SQL } from "./demoCleanup";

describe("demo cleanup policy", () => {
  it("deletes only expired or explicitly revoked demo sessions", () => {
    expect(DEMO_SESSION_CLEANUP_SQL).toMatch(/delete from demo_sessions/i);
    expect(DEMO_SESSION_CLEANUP_SQL).toMatch(/expires_at < now\(\)/i);
    expect(DEMO_SESSION_CLEANUP_SQL).toMatch(/revoked_at is not null/i);
    expect(DEMO_SESSION_CLEANUP_SQL).not.toMatch(/organizations|users|tickets/i);
  });
});
