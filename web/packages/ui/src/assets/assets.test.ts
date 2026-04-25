import { describe, it, expect } from "vitest";
import meta from "./assets-meta.json";

const ASSETS = [
  "issuer-empty-state.jpg",
  "distributor-empty-state.jpg",
  "ops-console-empty-state.jpg",
  "admin-empty-state.jpg",
] as const;

const PORTAL_BY_ASSET: Record<(typeof ASSETS)[number], string> = {
  "issuer-empty-state.jpg": "issuer-portal",
  "distributor-empty-state.jpg": "distributor-portal",
  "ops-console-empty-state.jpg": "ops-console",
  "admin-empty-state.jpg": "admin",
};

describe("ui asset registry", () => {
  it("includes metadata for every shipped portal hero", () => {
    for (const asset of ASSETS) {
      expect(meta).toHaveProperty(asset);
    }
  });

  it("each entry points consumed_by at the correct portal", () => {
    for (const asset of ASSETS) {
      const portal = PORTAL_BY_ASSET[asset];
      expect((meta as Record<string, { consumed_by: string }>)[asset].consumed_by).toContain(
        portal,
      );
    }
  });

  it("records the generation tool and a non-trivial prompt summary on every entry", () => {
    for (const asset of ASSETS) {
      const entry = (meta as Record<string, { tool: string; prompt_summary: string }>)[asset];
      expect(entry.tool).toContain("nano-banana");
      expect(entry.prompt_summary.length).toBeGreaterThan(40);
    }
  });
});
