import { describe, expect, it } from "vitest";
import { PUBLIC_SURFACE_PATHS, isPublicProductSurface } from "./productSurface";

describe("public product surface routing", () => {
  it("keeps the marketing and interactive demo entry points separate from production SaaS routes", () => {
    expect(isPublicProductSurface(PUBLIC_SURFACE_PATHS.marketing)).toBe(true);
    expect(isPublicProductSurface(PUBLIC_SURFACE_PATHS.interactiveDemo)).toBe(true);
    expect(isPublicProductSurface(PUBLIC_SURFACE_PATHS.workspaceCreation)).toBe(false);
    expect(isPublicProductSurface(PUBLIC_SURFACE_PATHS.signIn)).toBe(false);
    expect(PUBLIC_SURFACE_PATHS.interactiveDemo).not.toBe(PUBLIC_SURFACE_PATHS.workspaceCreation);
  });
});
