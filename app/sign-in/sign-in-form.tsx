"use client";

import { useActionState } from "react";
import { sendLink, type SignInState } from "./actions";

const initial: SignInState = { status: "idle" };

export function SignInForm({ linkError }: { linkError: boolean }) {
  const [state, action, pending] = useActionState(sendLink, initial);

  if (state.status === "sent") {
    return (
      <div className="card" role="status" style={{ marginTop: "var(--space-4)" }}>
        <p className="caption">Check your email</p>
        <p>We sent you a sign-in link. Open it on this device.</p>
      </div>
    );
  }

  const message =
    state.status === "error"
      ? state.message
      : linkError
        ? "That link didn't work. Ask for a new one."
        : undefined;

  return (
    <form action={action} noValidate>
      <div>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input
          className="field-input"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-describedby={message ? "email-error" : undefined}
        />
        {message ? (
          <p className="field-error" id="email-error" role="alert">
            {message}
          </p>
        ) : null}
      </div>
      <button className="button button-primary" type="submit" disabled={pending}>
        Send me a link
      </button>
    </form>
  );
}
