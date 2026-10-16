"use client";

import { useId, useState } from "react";
import { markEntered, subscribe, type SubscribeResult } from "@/lib/gateway";
import { getSupabase } from "@/lib/supabaseClient";

const MESSAGES: Partial<Record<SubscribeResult, string>> = {
  invalid: "Please enter a valid email address.",
  unavailable: "Sign-up isn’t available right now. Please try again later.",
  error: "We couldn’t save your email. Please check your connection and try again.",
};

/** The welcome gateway: an email, then into the app. */
export function GatewayForm({ onEnter }: { onEnter: () => void }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | SubscribeResult>("idle");
  const message = MESSAGES[status as SubscribeResult];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const result = await subscribe(email, getSupabase());
    if (result === "subscribed" || result === "returning") {
      // Returning students (already subscribed) are let in exactly like new ones.
      markEntered();
      onEnter();
      return;
    }
    setStatus(result);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-20 sm:px-8">
      <p className="small-caps text-sm tracking-[0.12em] text-muted">Scriptura sui ipsius interpres</p>
      <h1 className="mt-3 font-serif text-5xl font-normal tracking-tight sm:text-6xl">Bible Study</h1>
      <p className="mt-5 font-serif text-xl leading-relaxed text-text/90">
        Scripture interprets Scripture. Enter your email to begin studying.
      </p>

      <form onSubmit={submit} noValidate className="mt-10">
        <label htmlFor={`${id}-email`} className="text-xs tracking-[0.12em] text-muted">
          EMAIL
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status !== "sending") setStatus("idle");
            }}
            aria-invalid={status === "invalid"}
            aria-describedby={message ? `${id}-msg` : undefined}
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-md border border-rule bg-surface px-4 py-3 text-base text-text outline-none transition-colors placeholder:text-muted focus:border-accent"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-md border border-accent px-6 py-3 text-sm tracking-[0.08em] text-accent transition-colors hover:bg-accent/10 disabled:opacity-60"
          >
            {status === "sending" ? "Entering…" : "Enter"}
          </button>
        </div>
        <p id={`${id}-msg`} role="alert" className="mt-3 min-h-5 text-sm text-text">
          {message}
        </p>
      </form>
    </div>
  );
}
