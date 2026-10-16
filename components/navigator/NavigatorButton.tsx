"use client";

import { OPEN_NAVIGATOR_EVENT } from "./Navigator";

export function NavigatorButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_NAVIGATOR_EVENT))}
      className="flex items-center gap-3 rounded-full border border-rule px-4 py-1.5 text-sm text-muted transition-colors hover:border-text/40 hover:text-text"
    >
      Go to…
      <kbd className="hidden sm:inline">⌘K</kbd>
    </button>
  );
}
