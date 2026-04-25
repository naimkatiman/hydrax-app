import { describe, it, expect } from "vitest";
import meta from "./assets-meta.json";

describe("ui asset registry", () => {
  it("includes issuer-empty-state.jpg metadata", () => {
    expect(meta).toHaveProperty("issuer-empty-state.jpg");
    expect(meta["issuer-empty-state.jpg"].consumed_by).toContain("issuer-portal");
  });

  it("records the generation tool and prompt summary", () => {
    const entry = meta["issuer-empty-state.jpg"];
    expect(entry.tool).toContain("nano-banana");
    expect(entry.prompt_summary.length).toBeGreaterThan(40);
  });
});
