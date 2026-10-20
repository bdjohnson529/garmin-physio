import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static files and the public share page, which must set no cookies.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|s/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)"],
};
