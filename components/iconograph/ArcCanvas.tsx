"use client";

import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { select } from "d3-selection";
import "d3-transition";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadOverview, loadVerseEdges } from "@/lib/iconograph/data";
import type { OverviewData } from "@/lib/iconograph/format";
import {
  CanonAxis,
  arcsTouchingChapter,
  chapterArcs,
  filterArcs,
  verseArcs,
  type ArcFilters,
  type ArcSet,
} from "@/lib/iconograph/model";
import { drawArcs, drawAxis, drawHighlight, hitTest, readPalette, type Palette, type Viewport } from "@/lib/iconograph/render";
import { readerQuery, type TranslationId } from "@/lib/reader/state";
import { TOTAL_CHAPTERS, chapterFromOrdinal } from "@/lib/refs";
import { HoverCard, type HoverTarget } from "./HoverCard";

/** Verse-level detail appears once fewer than this many chapters are on screen. */
const VERSE_LOD_SPAN = 120;
const MAX_WINDOW = 159; // matches the edges API limit
const SETTLE_MS = 140;
/** Below this full-render cost, render live during gestures instead of previewing a bitmap. */
const LIVE_RENDER_MS = 10;

export interface ArcStats {
  level: "chapter" | "verse";
  shown: number;
  total: number;
  renderMs: number;
  loading: boolean;
}

interface Props {
  variant: "full" | "strip";
  filters: ArcFilters;
  /** Chapter ordinal whose arcs stay highlighted. */
  focusChapter?: number | null;
  /** Chapters containing a lemma: arcs whose two ends both contain it stay highlighted. */
  lemmaChapters?: ReadonlySet<number> | null;
  translations: TranslationId[];
  onStats?: (s: ArcStats & { highlighted: number }) => void;
  /** Strip variant: where a click goes. */
  stripHref?: string;
  className?: string;
}

export function ArcCanvas({ variant, filters, focusChapter = null, lemmaChapters = null, translations, onStats, stripHref, className = "" }: Props) {
  const full = variant === "full";
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [palette, setPalette] = useState<Palette | null>(null);
  const [verseWindow, setVerseWindow] = useState<{ lo: number; hi: number; set: ArcSet } | null>(null);
  const [inVerseRange, setInVerseRange] = useState(false);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [hover, setHover] = useState<HoverTarget | null>(null);

  // Imperative render state (changes every frame; never triggers React renders).
  const r = useRef({
    transform: zoomIdentity as ZoomTransform,
    snapshot: null as HTMLCanvasElement | null,
    snapshotTransform: zoomIdentity as ZoomTransform,
    drawn: new Uint32Array(0) as Uint32Array<ArrayBufferLike>,
    needsFull: true,
    gesturing: false,
    lastRenderMs: 0,
    frame: 0,
    settleTimer: 0 as ReturnType<typeof setTimeout> | 0,
    hoverArc: null as number | null,
    hoverChapter: null as number | null,
    pointer: null as { x: number; y: number } | null,
  });
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);

  useEffect(() => {
    let live = true;
    loadOverview()
      .then((o) => live && setOverview(o))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const axis = useMemo(() => (overview ? new CanonAxis(overview.verseCounts) : null), [overview]);
  const chapterSet = useMemo(() => (overview ? chapterArcs(overview) : null), [overview]);
  const set = full && inVerseRange && verseWindow ? verseWindow.set : chapterSet;
  const indices = useMemo(() => (set && axis ? filterArcs(set, filters, axis) : new Uint32Array(0)), [set, axis, filters]);
  const focusArcs = useMemo(() => {
    if (!set || (!focusChapter && !lemmaChapters)) return [];
    const out: number[] = [];
    for (const i of indices) {
      if (focusChapter && set.c1[i] !== focusChapter && set.c2[i] !== focusChapter) continue;
      if (lemmaChapters && !(lemmaChapters.has(set.c1[i]) && lemmaChapters.has(set.c2[i]))) continue;
      out.push(i);
    }
    return out;
  }, [set, indices, focusChapter, lemmaChapters]);
  const highlighting = focusChapter !== null || lemmaChapters !== null;

  // Size + palette (re-read on theme changes).
  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const readTheme = () => setPalette(readPalette(el));
    readTheme();
    mq.addEventListener("change", readTheme);
    const mo = new MutationObserver(readTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", readTheme);
      mo.disconnect();
    };
  }, []);

  const axisH = full ? 40 : 10;
  const viewport = useCallback(
    (t: ZoomTransform): Viewport => {
      const { w, h } = size;
      const baseline = h - axisH;
      const unit = w / TOTAL_CHAPTERS;
      return {
        width: w,
        height: h,
        baseline,
        // True semicircles when the canon's widest arc fits; otherwise flatten to fit.
        yScale: Math.min(1, (baseline - 6) / (w / 2)),
        x: (u: number) => t.x + t.k * u * unit,
      };
    },
    [size, axisH],
  );

  // ---- Drawing -------------------------------------------------------------

  const drawOverlay = useCallback(() => {
    const cv = overlayRef.current;
    if (!cv || !axis || !set || !palette) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const st = r.current;
    const vp = viewport(st.transform);

    let hl: number[] = [];
    if (st.hoverArc !== null) hl = [st.hoverArc];
    else if (st.hoverChapter !== null) hl = arcsTouchingChapter(set, indices, st.hoverChapter);
    else if (focusArcs.length) hl = focusArcs;

    if (hl.length || st.hoverChapter !== null || highlighting) {
      ctx.fillStyle = palette.ground;
      ctx.globalAlpha = 0.62;
      ctx.fillRect(0, 0, size.w, vp.baseline);
      ctx.globalAlpha = 1;
      drawHighlight(ctx, set, hl, vp, palette.accent, full ? 1.6 : 1.1);
    }

    // Ticks for chapters that contain the lemma.
    if (lemmaChapters) {
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha = 0.8;
      for (const c of lemmaChapters) {
        const a = vp.x(c - 1);
        const b = vp.x(c);
        if (b < 0 || a > size.w) continue;
        ctx.fillRect(a, vp.baseline + 1, Math.max(1, b - a), 3);
      }
      ctx.globalAlpha = 1;
    }
    // Marker for the focus or hovered chapter on the axis.
    for (const c of [focusChapter, st.hoverChapter]) {
      if (!c) continue;
      const a = vp.x(c - 1);
      const b = vp.x(c);
      ctx.fillStyle = palette.accent;
      ctx.fillRect(a, vp.baseline + 1, Math.max(2, b - a), full ? 10 : 7);
    }
    drawAxis(ctx, axis, vp, palette, !full);
  }, [axis, set, palette, size, viewport, indices, focusArcs, focusChapter, lemmaChapters, highlighting, full]);

  const renderFull = useCallback(() => {
    const cv = baseRef.current;
    if (!cv || !set || !palette || !size.w) return;
    const st = r.current;
    const dpr = window.devicePixelRatio || 1;
    const ctx = cv.getContext("2d")!;
    const t0 = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    st.drawn = drawArcs(ctx, set, indices, viewport(st.transform), palette, {
      alphaScale: full ? 1 : 0.7,
      lineWidth: full ? 0.8 : 0.6,
    });
    st.lastRenderMs = performance.now() - t0;
    performance.measure(`iconograph:render:${full ? "full" : "strip"}:${set.level}`, { start: t0, duration: st.lastRenderMs });
    // Keep a bitmap of this render for cheap previews during gestures.
    st.snapshot ??= document.createElement("canvas");
    st.snapshot.width = cv.width;
    st.snapshot.height = cv.height;
    st.snapshot.getContext("2d")!.drawImage(cv, 0, 0);
    st.snapshotTransform = st.transform;
    st.needsFull = false;
  }, [set, palette, size, indices, viewport, full]);

  const renderPreview = useCallback(() => {
    const cv = baseRef.current;
    const st = r.current;
    if (!cv || !st.snapshot) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = cv.getContext("2d")!;
    const s = st.transform.k / st.snapshotTransform.k;
    const baseline = size.h - axisH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    // Arcs scale uniformly about the baseline, so a scaled bitmap is geometrically exact.
    ctx.setTransform(s, 0, 0, s, dpr * (st.transform.x - s * st.snapshotTransform.x), dpr * baseline * (1 - s));
    ctx.drawImage(st.snapshot, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [size, axisH]);

  const schedule = useCallback(() => {
    const st = r.current;
    if (st.frame) return;
    st.frame = requestAnimationFrame(() => {
      st.frame = 0;
      if (st.needsFull && (!st.gesturing || st.lastRenderMs < LIVE_RENDER_MS)) renderFull();
      else if (st.needsFull) renderPreview();
      drawOverlay();
    });
  }, [renderFull, renderPreview, drawOverlay]);

  // Canvas backing-store size.
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    for (const cv of [baseRef.current, overlayRef.current]) {
      if (!cv) continue;
      cv.width = Math.round(size.w * dpr);
      cv.height = Math.round(size.h * dpr);
    }
    r.current.needsFull = true;
    schedule();
  }, [size, schedule]);

  // Anything that changes what's drawn.
  useEffect(() => {
    r.current.needsFull = true;
    schedule();
  }, [set, indices, palette, schedule]);

  useEffect(() => {
    schedule();
  }, [focusArcs, schedule]);

  useEffect(() => {
    onStats?.({
      level: set?.level ?? "chapter",
      shown: indices.length,
      total: set?.n ?? 0,
      renderMs: Math.round(r.current.lastRenderMs),
      loading: !overview || loadingVerses,
      highlighted: focusArcs.length,
    });
  }, [indices, set, overview, loadingVerses, onStats, focusArcs]);

  // ---- Level of detail -----------------------------------------------------

  const updateLod = useCallback(() => {
    if (!full || !size.w) return;
    const t = r.current.transform;
    const unit = size.w / TOTAL_CHAPTERS;
    const u0 = Math.max(0, -t.x / (t.k * unit));
    const u1 = Math.min(TOTAL_CHAPTERS, (size.w - t.x) / (t.k * unit));
    const span = u1 - u0;
    const want = span <= VERSE_LOD_SPAN;
    setInVerseRange(want);
    if (!want) return;
    const lo = Math.max(1, Math.floor(u0) + 1);
    const hi = Math.min(TOTAL_CHAPTERS, Math.ceil(u1));
    if (verseWindow && verseWindow.lo <= lo && verseWindow.hi >= hi) return;
    const pad = Math.floor((MAX_WINDOW - (hi - lo)) / 2);
    const wlo = Math.max(1, lo - pad);
    const whi = Math.min(TOTAL_CHAPTERS, wlo + MAX_WINDOW - 1);
    setLoadingVerses(true);
    loadVerseEdges(wlo, whi)
      .then((edges) => {
        if (!axis) return;
        setVerseWindow({ lo: wlo, hi: whi, set: verseArcs(edges, axis) });
      })
      .catch(console.error)
      .finally(() => setLoadingVerses(false));
  }, [full, size.w, verseWindow, axis]);

  // ---- Zoom ----------------------------------------------------------------

  useEffect(() => {
    const cv = overlayRef.current;
    if (!cv || !full || !size.w) return;
    const z = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 1500])
      .extent([[0, 0], [size.w, size.h]])
      .translateExtent([[0, 0], [size.w, size.h]])
      .on("zoom", (e: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        const st = r.current;
        st.transform = e.transform;
        st.gesturing = true;
        st.needsFull = true;
        st.hoverArc = null;
        setHover(null);
        if (st.settleTimer) clearTimeout(st.settleTimer);
        st.settleTimer = setTimeout(() => {
          st.gesturing = false;
          st.needsFull = true;
          schedule();
          updateLod();
        }, SETTLE_MS);
        schedule();
      });
    zoomRef.current = z;
    const sel = select(cv);
    sel.call(z).on("dblclick.zoom", null);
    sel.call(z.transform, r.current.transform);
    return () => {
      sel.on(".zoom", null);
    };
  }, [full, size, schedule, updateLod]);

  const zoomBy = (k: number) => {
    const cv = overlayRef.current;
    if (!cv || !zoomRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    select(cv).transition().duration(reduce ? 0 : 250).call(zoomRef.current.scaleBy, k);
  };
  const panBy = (dx: number) => {
    const cv = overlayRef.current;
    if (!cv || !zoomRef.current) return;
    select(cv).call(zoomRef.current.translateBy, dx / r.current.transform.k, 0);
  };
  const reset = () => {
    const cv = overlayRef.current;
    if (cv && zoomRef.current) select(cv).call(zoomRef.current.transform, zoomIdentity);
  };

  // ---- Pointer -------------------------------------------------------------

  const hoverFrame = useRef(0);
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    r.current.pointer = p;
    if (hoverFrame.current || r.current.gesturing || e.buttons) return;
    hoverFrame.current = requestAnimationFrame(() => {
      hoverFrame.current = 0;
      const st = r.current;
      if (!set || !axis || !st.pointer) return;
      const vp = viewport(st.transform);
      const { x, y } = st.pointer;
      let target: HoverTarget | null = null;
      st.hoverArc = null;
      st.hoverChapter = null;
      if (y > vp.baseline) {
        const unit = (vp.x(1) - vp.x(0));
        const c = Math.floor((x - vp.x(0)) / unit) + 1;
        if (c >= 1 && c <= TOTAL_CHAPTERS) {
          st.hoverChapter = c;
          target = { type: "chapter", chapter: c, links: arcsTouchingChapter(set, indices, c).length, x, y };
        }
      } else if (full) {
        const i = hitTest(set, st.drawn, vp, x, y);
        if (i !== null) {
          st.hoverArc = i;
          target =
            set.level === "chapter"
              ? { type: "chapterArc", a: set.c1[i], b: set.c2[i], refs: set.refCount![i], x, y }
              : { type: "verseArc", from: set.verses![i * 3], toStart: set.verses![i * 3 + 1], toEnd: set.verses![i * 3 + 2], votes: set.strength[i], x, y };
        }
      }
      setHover(target);
      drawOverlay();
    });
  }

  function onPointerLeave() {
    const st = r.current;
    st.pointer = null;
    st.hoverArc = null;
    st.hoverChapter = null;
    setHover(null);
    drawOverlay();
  }

  function hrefForChapter(c: number, verse?: number) {
    const loc = chapterFromOrdinal(c)!;
    return `/read/${loc.book.slug}/${loc.chapter}${readerQuery({ translations, verse })}`;
  }

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!full) {
      if (stripHref) router.push(stripHref);
      return;
    }
    const st = r.current;
    if (!set || !axis) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const vp = viewport(st.transform);
    if (st.hoverChapter !== null) router.push(hrefForChapter(st.hoverChapter));
    else if (st.hoverArc !== null) {
      const i = st.hoverArc;
      // Go to whichever end of the arc is nearer the pointer.
      const nearFirst = Math.abs(x - vp.x(set.x1[i])) <= Math.abs(x - vp.x(set.x2[i]));
      if (set.level === "chapter") router.push(hrefForChapter(nearFirst ? set.c1[i] : set.c2[i]));
      else {
        const [from, toStart] = [set.verses![i * 3], set.verses![i * 3 + 1]];
        const fromIsFirst = axis.verseX(from) <= axis.verseX(toStart);
        const ord = nearFirst === fromIsFirst ? from : toStart;
        const ref = axis.verseRef(ord);
        router.push(hrefForChapter(ref.chapterOrd, ref.verse));
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!full) return;
    const step = size.w * 0.15;
    const map: Record<string, () => void> = {
      "+": () => zoomBy(1.6),
      "=": () => zoomBy(1.6),
      "-": () => zoomBy(1 / 1.6),
      ArrowLeft: () => panBy(step),
      ArrowRight: () => panBy(-step),
      "0": reset,
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }

  const label = full
    ? "Cross-reference arc diagram of the whole Bible. Scroll or pinch to zoom, drag to pan, or use + and − and the arrow keys. Hover an arc to read both passages; click to open it."
    : "Cross-references from this chapter across the whole Bible. Click to open the Iconograph.";

  return (
    <div
      ref={wrapRef}
      className={`relative select-none ${className}`}
      tabIndex={full ? 0 : -1}
      onKeyDown={onKeyDown}
      role="img"
      aria-label={label}
    >
      <canvas ref={baseRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <canvas
        ref={overlayRef}
        aria-hidden
        className={`absolute inset-0 h-full w-full touch-none ${full ? (hover ? "cursor-pointer" : "cursor-grab active:cursor-grabbing") : "cursor-pointer"}`}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
      />
      {failed && <p className="absolute inset-0 grid place-items-center text-sm text-muted">The Iconograph could not be loaded.</p>}
      {!overview && !failed && full && (
        <p className="absolute inset-0 grid place-items-center text-sm text-muted">Drawing the canon…</p>
      )}
      {hover && axis && full && <HoverCard target={hover} axis={axis} translation={translations[0]} bounds={size} />}
    </div>
  );
}
