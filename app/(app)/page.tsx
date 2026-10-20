import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/server";

export default async function ActivitiesPage() {
  const supabase = await createClient();
  const { count } = await supabase.from("activities").select("id", { count: "exact", head: true });

  return (
    <main>
      <h1 className="page-title">Activities</h1>
      {count ? (
        <p>{count} activities imported.</p>
      ) : (
        <EmptyState
          message="Import your Garmin file to see your activities"
          actionLabel="Import"
          href="/import"
        />
      )}
    </main>
  );
}
