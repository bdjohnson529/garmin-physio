import { APP_NAME } from "@/lib/app";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="signin">
      <h1 className="page-title">Sign in</h1>
      <p>{APP_NAME}</p>
      <SignInForm linkError={error === "link"} />
    </main>
  );
}
