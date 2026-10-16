"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Genre } from "@/lib/refs";
import { genreOfVerse, readGenreColors } from "@/lib/threads/genres";
import { yOfVerse } from "@/lib/threads/geometry";
import type { ThreadRef } from "@/lib/threads/types";

interface Props {
  height: number;
  refsByVerse: Map<number, ThreadRef[]>;
  maxVotes: number;
  /** Anchor element per verse (its reference count, at the text column's right edge). */
  anchors: React.RefObject<Map<number, HTMLElement>>;
  selected: number | null;
  hoverVerse: number | null;
  hoverBookId: number | null; // book id
}

/**
 * Curves from every visible verse to where its references land on the canon axis. Redrawn on
 * scroll from the verses' live positions, so the threads follow the text as you read.
 */
export function ThreadCanvas({ height, refsByVerse, maxVotes, anchors, selected, hoverVerse, hoverBookId }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colors = useRef<Record<Genre, string> | null>(null);
  const frame = useRef(0);

  const draw = useCallback(() => {
    frame.current = 0;
    const cv = ref.current;
    if (!cv) return;
    const w = cv.clientWidth;
    const h = height;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    colors.current ??= readGenreColors(cv);
    const top = cv.getBoundingClientRect().top;
    // The selected verse stays emphasized while another is hovered.
    const isFocus = (v: number) => v === selected || v === hoverVerse;
    const anyFocus = selected !== null || hoverVerse !== null;

    const curve = (y0: number, r: ThreadRef) => {
      const y1 = yOfVerse(r[4], h);
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.bezierCurveTo(w * 0.42, y0, w * 0.58, y1, w, y1);
      ctx.stroke();
    };
    const anchorY = (v: number) => {
      const el = anchors.current?.get(v);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2 - top;
    };

    // Faint threads for every verse in view; the focused verse and hovered book draw on top.
    const strong: [number, ThreadRef][] = [];
    for (const [v, refs] of refsByVerse) {
      const y0 = anchorY(v);
      if (y0 === null) continue;
      const inView = y0 > -40 && y0 < h + 40;
      for (const r of refs) {
        const toHoverBook = hoverBookId !== null && Math.floor(r[1] / 1_000_000) === hoverBookId;
        if (isFocus(v) || (toHoverBook && inView)) {
          strong.push([Math.min(Math.max(y0, 0), h), r]);
          continue;
        }
        if (!inView) continue;
        const t = Math.sqrt(r[3] / maxVotes);
        ctx.strokeStyle = colors.current[genreOfVerse(r[1])];
        ctx.globalAlpha = (anyFocus || hoverBookId !== null ? 0.07 : 0.14) + 0.22 * t;
        ctx.lineWidth = 1;
        curve(y0, r);
      }
    }
    for (const [y0, r] of strong) {
      ctx.strokeStyle = colors.current[genreOfVerse(r[1])];
      ctx.globalAlpha = 0.55 + 0.4 * Math.sqrt(r[3] / maxVotes);
      ctx.lineWidth = 1.5;
      curve(y0, r);
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.current[genreOfVerse(r[1])];
      ctx.beginPath();
      ctx.arc(w - 2.5, yOfVerse(r[4], h), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [height, refsByVerse, maxVotes, anchors, selected, hoverVerse, hoverBookId]);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [schedule]);

  return <canvas ref={ref} aria-hidden className="block h-full w-full" />;
}
