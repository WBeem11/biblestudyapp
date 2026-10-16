"use client";

import { useState, useSyncExternalStore } from "react";
import { hasEntered } from "@/lib/gateway";
import { GatewayForm } from "./GatewayForm";

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange); // another tab entered
  return () => window.removeEventListener("storage", onChange);
};

/**
 * Shows the welcome gateway until the visitor has entered (localStorage flag), then the app hub.
 * The flag only exists in the browser, so the prerendered HTML holds the hub invisibly until known.
 */
export function WelcomeGate({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, hasEntered, () => null);
  const [enteredNow, setEnteredNow] = useState(false);
  const entered = enteredNow || stored === true;

  if (stored === null) return <div className="invisible flex flex-1 flex-col">{children}</div>;
  if (entered) return <div className={`flex flex-1 flex-col ${enteredNow ? "animate-[gate-in_400ms_ease-out]" : ""}`}>{children}</div>;
  return <GatewayForm onEnter={() => setEnteredNow(true)} />;
}
