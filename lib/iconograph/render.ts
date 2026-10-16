/** Canvas drawing and hit-testing for the Iconograph. Pure functions over an ArcSet. */
import type { ArcSet, CanonAxis } from "./model";

export interface Viewport {
  width: number; // CSS px
  height: number;
  baseline: number; // y of the axis line; arcs rise above it
  /** Arc height = horizontal radius × yScale (1 = true semicircles). */
  yScale: number;
  /** Chapter units → CSS px. */
  x: (u: number) => number;
}

export interface Palette {
  ink: string; // within-testament arcs
  bridge: string; // OT↔NT arcs
  accent: string;
  ground: string;
  muted: string;
  rule: string;
  surface: string;
  /** Resolved UI font family (canvas can't read CSS variables). */
  font: string;
}

export function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    ink: v("--text"),
    bridge: v("--accent-graphic"),
    accent: v("--accent-graphic"),
    ground: v("--ground"),
    muted: v("--text-muted"),
    rule: v("--rule"),
    surface: v("--surface"),
    font: getComputedStyle(document.body).fontFamily,
  };
}

interface Geometry {
  cx: number;
  r: number;
  ry: number;
}

/** Screen geometry of arc i, or null when it can't be seen (off-screen, sub-pixel, or above the top). */
function geometry(s: ArcSet, i: number, vp: Viewport): Geometry | null {
  const a = vp.x(s.x1[i]);
  const b = vp.x(s.x2[i]);
  if (b < 0 || a > vp.width) return null;
  const r = (b - a) / 2;
  const ry = r * vp.yScale;
  if (ry < 0.35) return null;
  const cx = a + r;
  if (ry > vp.baseline) {
    // Lowest visible point of the arc within the viewport; skip if even that is above the top.
    const dx = Math.min(r, Math.max(Math.abs(Math.max(0, a) - cx), Math.abs(Math.min(vp.width, b) - cx)));
    if (ry * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2)) > vp.baseline) return null;
  }
  return { cx, r, ry };
}

/**
 * Draw arcs one stroke each, weakest first, so overlapping low-alpha strokes accumulate:
 * density reads as tone. Returns the indices actually drawn (for hit-testing).
 */
export function drawArcs(
  ctx: CanvasRenderingContext2D,
  s: ArcSet,
  indices: ArrayLike<number>,
  vp: Viewport,
  pal: Palette,
  opts: { alphaScale?: number; lineWidth?: number } = {},
): Uint32Array {
  const drawn = new Uint32Array(indices.length);
  let m = 0;
  let maxStrength = 1;
  for (let j = 0; j < indices.length; j++) maxStrength = Math.max(maxStrength, s.strength[indices[j]]);
  const alphaScale = opts.alphaScale ?? 1;
  ctx.lineWidth = opts.lineWidth ?? 0.8;
  let lastColor = "";
  for (let j = 0; j < indices.length; j++) {
    const i = indices[j];
    const g = geometry(s, i, vp);
    if (!g) continue;
    const color = s.kind[i] === 2 ? pal.bridge : pal.ink;
    if (color !== lastColor) {
      ctx.strokeStyle = color;
      lastColor = color;
    }
    const t = Math.sqrt(Math.max(0, s.strength[i]) / maxStrength);
    ctx.globalAlpha = Math.min(1, (0.05 + 0.55 * t) * alphaScale);
    ctx.beginPath();
    ctx.ellipse(g.cx, vp.baseline, g.r, g.ry, 0, Math.PI, 2 * Math.PI);
    ctx.stroke();
    drawn[m++] = i;
  }
  ctx.globalAlpha = 1;
  return drawn.subarray(0, m);
}

/** Highlighted arcs: a uniform accent stroke on top of everything. */
export function drawHighlight(ctx: CanvasRenderingContext2D, s: ArcSet, indices: ArrayLike<number>, vp: Viewport, color: string, lineWidth = 1.6) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = indices.length > 200 ? 0.5 : 0.9;
  for (let j = 0; j < indices.length; j++) {
    const g = geometry(s, indices[j], vp);
    if (!g) continue;
    ctx.beginPath();
    ctx.ellipse(g.cx, vp.baseline, g.r, g.ry, 0, Math.PI, 2 * Math.PI);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Nearest drawn arc to (px, py) within `tolerance` CSS px; ties go to the stronger (later) arc. */
export function hitTest(s: ArcSet, drawn: Uint32Array, vp: Viewport, px: number, py: number, tolerance = 5): number | null {
  if (py > vp.baseline) return null;
  let best: number | null = null;
  let bestD = tolerance;
  for (let j = 0; j < drawn.length; j++) {
    const i = drawn[j];
    const a = vp.x(s.x1[i]);
    const b = vp.x(s.x2[i]);
    if (px < a - tolerance || px > b + tolerance) continue;
    const r = (b - a) / 2;
    const ry = r * vp.yScale;
    const cx = a + r;
    // Point on the ellipse along the ray from its center through the pointer.
    const t = Math.atan2((vp.baseline - py) / ry, (px - cx) / r);
    const ex = cx + r * Math.cos(t);
    const ey = vp.baseline - ry * Math.sin(t);
    const d = Math.hypot(px - ex, py - ey);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Book bands, labels and (when zoomed in) chapter numbers below the baseline. */
export function drawAxis(ctx: CanvasRenderingContext2D, axis: CanonAxis, vp: Viewport, pal: Palette, compact: boolean) {
  const y = vp.baseline;
  const bandTop = y + 3;
  const bandH = compact ? 4 : 5;
  ctx.font = `500 10px ${pal.font}`;
  ctx.textBaseline = "alphabetic";
  const chapterPx = vp.x(1) - vp.x(0);

  for (const { book, start, end } of axis.books) {
    const a = vp.x(start);
    const b = vp.x(end);
    if (b < 0 || a > vp.width) continue;
    ctx.fillStyle = book.id % 2 ? pal.rule : pal.muted;
    ctx.globalAlpha = book.testament === "NT" ? 0.9 : 0.55;
    ctx.fillRect(a, bandTop, Math.max(0.5, b - a - (b - a > 3 ? 0.75 : 0)), bandH);
    ctx.globalAlpha = 1;
    if (compact) continue;

    // Book label centered in the visible part of the book, if it fits.
    const va = Math.max(a, 0);
    const vb = Math.min(b, vp.width);
    const label = ctx.measureText(book.name).width + 8 < vb - va ? book.name : ctx.measureText(book.osis).width + 6 < vb - va ? book.osis : "";
    if (label) {
      ctx.fillStyle = pal.muted;
      ctx.textAlign = "center";
      ctx.fillText(label, (va + vb) / 2, bandTop + bandH + (chapterPx >= 16 ? 26 : 14));
    }
  }

  if (!compact && chapterPx >= 16) {
    ctx.fillStyle = pal.muted;
    ctx.textAlign = "center";
    for (const { start, end } of axis.books) {
      if (vp.x(end) < 0 || vp.x(start) > vp.width) continue;
      const step = chapterPx >= 26 ? 1 : 5;
      for (let c = start; c < end; c++) {
        const n = c - start + 1;
        if (n !== 1 && n % step) continue;
        const px = vp.x(c + 0.5);
        if (px < -10 || px > vp.width + 10) continue;
        ctx.fillText(String(n), px, bandTop + bandH + 12);
      }
    }
  }
  ctx.textAlign = "start";
}
