"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_FILTERS, type ArcFilters } from "@/lib/iconograph/model";
import type { TranslationId } from "@/lib/reader/state";
import { ArcCanvas } from "./ArcCanvas";

const STRIP_FILTERS: ArcFilters = { ...DEFAULT_FILTERS, strongestPct: 12 };

/** The current chapter's place in the canon's web of cross-references. Loads when scrolled into view. */
export function IconographStrip({
  chapterOrdinal,
  label,
  focusSlug,
  translations,
}: {
  chapterOrdinal: number;
  label: string;
  focusSlug: string;
  translations: TranslationId[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const t = translations.join(",");
  const href = `/iconograph?focus=${focusSlug}${t !== "BSB,KJV" ? `&t=${t}` : ""}`;

  return (
    <section aria-label={`${label} in the Iconograph`} className="mb-10">
      <div className="mb-1.5 flex items-baseline justify-between gap-4 text-xs">
        <span className="small-caps tracking-[0.12em] text-muted">{label} across the canon</span>
        <Link href={href} className="text-muted transition-colors hover:text-accent">
          Open Iconograph →
        </Link>
      </div>
      <div ref={ref} className="h-[4.5rem] border-b border-rule/60">
        {visible && (
          <ArcCanvas
            variant="strip"
            filters={STRIP_FILTERS}
            focusChapter={chapterOrdinal}
            translations={translations}
            stripHref={href}
            className="h-full w-full"
          />
        )}
      </div>
    </section>
  );
}
