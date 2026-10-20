import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/safe-next";

describe("safeNext", () => {
  it("keeps a path on this site", () => {
    expect(safeNext("/timeline?week=2026-10-12")).toBe("/timeline?week=2026-10-12");
  });
  it("falls back for missing values", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
  });
  it("rejects other sites", () => {
    expect(safeNext("https://example.com")).toBe("/");
    expect(safeNext("//example.com")).toBe("/");
    expect(safeNext("/\\example.com")).toBe("/");
  });
});
