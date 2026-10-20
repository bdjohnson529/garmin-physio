import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && publishableKey && serviceKey);

if (!configured) {
  console.warn(
    "RLS isolation test SKIPPED: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and " +
      "SUPABASE_SERVICE_ROLE_KEY in .env.local (use a test project, not one holding real data).",
  );
}

type TestUser = { id: string; client: SupabaseClient };

describe.skipIf(!configured)("row-level security isolates users", () => {
  let admin: SupabaseClient;
  const password = randomUUID();
  let a: TestUser;
  let b: TestUser;
  let aActivityId: string;

  async function makeUser(label: string): Promise<TestUser> {
    const email = `rls-${label}-${randomUUID()}@example.test`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    const client = createClient(url!, publishableKey!, { auth: { persistSession: false } });
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    return { id: created.data.user.id, client };
  }

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    a = await makeUser("a");
    b = await makeUser("b");

    const imp = await a.client.from("imports").insert({ user_id: a.id, filename: "a.csv" }).select("id").single();
    expect(imp.error).toBeNull();

    const act = await a.client
      .from("activities")
      .insert({
        user_id: a.id,
        external_key: "2026-10-18 17:42:45|Pool Swim",
        started_at: "2026-10-18T16:42:45Z",
        local_date: "2026-10-18",
        type_raw: "Pool Swim",
        sport_key: "swim",
        import_id: imp.data!.id,
      })
      .select("id")
      .single();
    expect(act.error).toBeNull();
    aActivityId = act.data!.id;
  });

  afterAll(async () => {
    // Deleting the auth user cascades through every table.
    for (const u of [a, b]) if (u) await admin.auth.admin.deleteUser(u.id);
  });

  it("lets the owner read their own rows", async () => {
    const { data } = await a.client.from("activities").select("id");
    expect(data?.map((r) => r.id)).toContain(aActivityId);
  });

  it("creates a profile for each new user", async () => {
    const { data } = await a.client.from("profiles").select("user_id, timezone");
    expect(data).toEqual([{ user_id: a.id, timezone: "Europe/London" }]);
  });

  it("hides the first user's rows from the second user", async () => {
    for (const table of ["activities", "imports", "profiles"]) {
      const { data, error } = await b.client.from(table).select("*").neq("user_id", b.id);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("stops the second user changing the first user's rows", async () => {
    const update = await b.client.from("activities").update({ title: "hacked" }).eq("id", aActivityId).select();
    expect(update.data ?? []).toEqual([]);

    const del = await b.client.from("activities").delete().eq("id", aActivityId).select();
    expect(del.data ?? []).toEqual([]);

    const profile = await b.client.from("profiles").update({ timezone: "UTC" }).eq("user_id", a.id).select();
    expect(profile.data ?? []).toEqual([]);

    const { data } = await admin.from("activities").select("title").eq("id", aActivityId).single();
    expect(data?.title).toBeNull();
  });

  it("stops the second user writing rows as the first user", async () => {
    const { error } = await b.client.from("activities").insert({
      user_id: a.id,
      external_key: "forged",
      started_at: "2026-10-18T00:00:00Z",
      local_date: "2026-10-18",
      type_raw: "Yoga",
      sport_key: "yoga",
    });
    expect(error).not.toBeNull();
  });

  it("gives anonymous visitors nothing", async () => {
    const anon = createClient(url!, publishableKey!, { auth: { persistSession: false } });
    const { data } = await anon.from("activities").select("id");
    expect(data ?? []).toEqual([]);
  });
});
