import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "components", "lib"];
const SERVER_ONLY_FILES = new Set(["lib/supabase/admin.ts", "lib/env.ts"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = SOURCE_DIRS.flatMap((d) => walk(join(ROOT, d))).map((p) => ({
  path: p.slice(ROOT.length + 1),
  text: readFileSync(p, "utf8"),
}));

describe("service-role key stays out of client code", () => {
  it("is never given a NEXT_PUBLIC_ name", () => {
    for (const f of files) expect(f.text, f.path).not.toMatch(/NEXT_PUBLIC_[A-Z_]*SERVICE/);
  });

  it("is referenced only from the server-only files", () => {
    for (const f of files) {
      if (SERVER_ONLY_FILES.has(f.path)) continue;
      expect(f.text, f.path).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(f.text, f.path).not.toContain("supabaseServiceRoleKey");
    }
  });

  it("is not imported by any client component", () => {
    for (const f of files) {
      if (!/^\s*["']use client["']/m.test(f.text)) continue;
      expect(f.text, f.path).not.toMatch(/supabase\/admin|createAdminClient|supabaseServiceRoleKey/);
    }
  });

  it("marks the admin client as server-only", () => {
    const admin = files.find((f) => f.path === "lib/supabase/admin.ts");
    expect(admin?.text).toContain('import "server-only"');
  });
});
