/** Turn user input into a safe FTS5 query. Client-safe. */

export const MARK_OPEN = "";
export const MARK_CLOSE = "";

/**
 * Words are ANDed; "quoted phrases" stay phrases; the last bare word may match as a prefix
 * (for search-as-you-type). Every term is double-quoted so FTS5 operators and column filters in
 * user input are treated as plain text. Returns null when nothing searchable remains.
 */
export function toFtsQuery(input: string, opts: { prefixLast?: boolean } = {}): string | null {
  const terms: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  let lastBare = -1;
  while ((m = re.exec(input))) {
    const raw = (m[1] ?? m[2]).replace(/[^\p{L}\p{N}\s'’-]/gu, " ").trim();
    if (!raw) continue;
    terms.push(`"${raw.replace(/"/g, '""')}"`);
    lastBare = m[1] === undefined ? terms.length - 1 : -1;
  }
  if (!terms.length) return null;
  if (opts.prefixLast && lastBare === terms.length - 1 && terms[lastBare].length >= 5) terms[lastBare] += "*";
  return terms.join(" ");
}

export interface SearchHit {
  verseId: number;
  snippet: string; // contains MARK_OPEN / MARK_CLOSE around matches
}

export interface SearchResults {
  total: number;
  offset: number;
  items: SearchHit[];
  /** Matches per book (index 0 = Genesis); present on the first page. */
  byBook?: number[];
}
