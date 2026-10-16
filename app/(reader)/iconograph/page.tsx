import { Suspense } from "react";
import { IconographView } from "@/components/iconograph/IconographView";

export const metadata = {
  title: "Iconograph · Bible Study",
  description: "Every cross-reference in the Bible drawn as an arc between the passages it connects.",
};

export default function IconographPage() {
  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col px-5 pb-4 pt-8 sm:px-8 md:h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))]">
      {/* Static header: prerendered, so it paints before any JavaScript runs. */}
      <header className="min-h-[7.5rem]">
        <p className="small-caps text-sm tracking-[0.12em] text-muted">Scripture interprets Scripture</p>
        <h1 className="mt-2 font-serif text-4xl font-normal tracking-tight sm:text-5xl">Iconograph</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Every chapter of the Bible lies along the line, Genesis to Revelation. Each arc joins two passages that
          cross-reference each other.
        </p>
      </header>
      <Suspense fallback={<div className="mt-6 min-h-[22rem] flex-1 border-t border-rule" />}>
        <IconographView />
      </Suspense>
    </div>
  );
}
