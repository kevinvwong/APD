import { describe, it, expect } from "vitest";
import { buildExcerpt } from "../excerpt";

describe("buildExcerpt", () => {
  it("returns null when the term is absent", () => {
    expect(buildExcerpt("the quick brown fox", "zebra")).toBeNull();
  });

  it("is case-insensitive", () => {
    const out = buildExcerpt("The Quick Brown Fox", "quick");
    expect(out).not.toBeNull();
    expect(out!.toLowerCase()).toContain("quick");
  });

  it("does not add a leading ellipsis when the match is at the very start", () => {
    const out = buildExcerpt("personnel recovery is the focus", "personnel");
    expect(out!.startsWith("…")).toBe(false);
  });

  it("adds leading and trailing ellipses when the match is in the interior", () => {
    const long = "x".repeat(200) + " NEEDLE " + "y".repeat(200);
    const out = buildExcerpt(long, "needle")!;
    expect(out.startsWith("… ")).toBe(true);
    expect(out.endsWith(" …")).toBe(true);
    expect(out.toLowerCase()).toContain("needle");
  });

  it("collapses runs of whitespace in the snippet", () => {
    const out = buildExcerpt("alpha    \n\n   bravo needle charlie", "needle")!;
    expect(out).not.toMatch(/\s{2,}/);
  });

  it("keeps the snippet bounded rather than returning the whole document", () => {
    const long = "z".repeat(5000) + " needle " + "z".repeat(5000);
    const out = buildExcerpt(long, "needle")!;
    expect(out.length).toBeLessThan(250);
  });
});
