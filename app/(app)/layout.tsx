import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");

  return (
    <div className="shell">
      <div className="shell-inner">
        <div className="shell-top">
          <form action="/auth/sign-out" method="post">
            <button className="button button-secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
