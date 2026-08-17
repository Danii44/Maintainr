import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const authMocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  revokeSession: vi.fn(),
  getSessionToken: vi.fn(),
  sessionCookieOptions: vi.fn(() => ({ httpOnly: true, sameSite: "lax", secure: true, path: "/" })),
}));

vi.mock("./auth", () => ({ ...authMocks, COOKIE_NAME: "app_session_id", ONE_YEAR_MS: 1000 * 60 * 60 * 24 * 365 }));

const user = { id: 7, openId: "local_7", clerkUserId: null, organizationId: 2, unitId: null, name: "Local User", email: "local@example.com", passwordHash: null, phone: null, role: "PROPERTY_MANAGER" as const, loginMethod: "password", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

function context() {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const cleared: Array<{ name: string; options: Record<string, unknown> }> = [];
  const ctx: TrpcContext = { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }), clearCookie: (name: string, options: Record<string, unknown>) => cleared.push({ name, options }) } as TrpcContext["res"] };
  return { ctx, cookies, cleared };
}

describe("local auth router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("signs in and sets a secure session cookie", async () => {
    authMocks.authenticate.mockResolvedValue({ user, token: "raw-session" });
    const { ctx, cookies } = context();
    const result = await appRouter.createCaller(ctx).auth.signIn({ email: "local@example.com", password: "password123" });
    expect(result).toEqual(user);
    expect(cookies[0]).toMatchObject({ name: "app_session_id", value: "raw-session", options: { httpOnly: true, secure: true, sameSite: "lax" } });
  });

  it("signs up and preserves the returned role", async () => {
    authMocks.register.mockResolvedValue({ user, token: "new-session" });
    const { ctx } = context();
    const result = await appRouter.createCaller(ctx).auth.signUp({ name: "Local User", email: "local@example.com", password: "password123" });
    expect(result.role).toBe("PROPERTY_MANAGER");
    expect(authMocks.register).toHaveBeenCalledWith("local@example.com", "password123", "Local User");
  });

  it("returns the authenticated context user through auth.me", async () => {
    const { ctx } = context();
    ctx.user = user;
    expect(await appRouter.createCaller(ctx).auth.me()).toEqual(user);
  });

  it("revokes the current session and clears the cookie on logout", async () => {
    authMocks.getSessionToken.mockResolvedValue("raw-session");
    const { ctx, cleared } = context();
    expect(await appRouter.createCaller(ctx).auth.logout()).toEqual({ success: true });
    expect(authMocks.revokeSession).toHaveBeenCalledWith("raw-session");
    expect(cleared[0]).toMatchObject({ name: "app_session_id", options: { maxAge: -1 } });
  });

  it("keeps reset requests generic and delegates token consumption", async () => {
    authMocks.requestPasswordReset.mockResolvedValue({ accepted: true });
    authMocks.resetPassword.mockResolvedValue({ success: true });
    const { ctx } = context();
    expect(await appRouter.createCaller(ctx).auth.requestPasswordReset({ email: "unknown@example.com" })).toEqual({ accepted: true });
    expect(await appRouter.createCaller(ctx).auth.resetPassword({ token: "a".repeat(20), password: "password123" })).toEqual({ success: true });
  });
});
