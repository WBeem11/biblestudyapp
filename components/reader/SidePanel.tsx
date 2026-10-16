/** Shared shell for reader side panels: sticky right column on desktop, bottom sheet below lg. */
export function SidePanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <aside
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 flex max-h-[55dvh] flex-col border-t border-rule bg-ground pb-[env(safe-area-inset-bottom,0px)] lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:z-auto lg:mt-14 lg:max-h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] lg:self-start lg:border-t-0 lg:border-l lg:pb-0"
    >
      {children}
    </aside>
  );
}

export function PanelClose({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className="-mr-1 rounded-full px-2 py-1 text-lg leading-none text-muted transition-colors hover:text-text"
    >
      ×
    </button>
  );
}
