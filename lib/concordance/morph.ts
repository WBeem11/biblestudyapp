/** Plain-English morphology from STEPBible code expansions. Client-safe. */

const ORDER = ["Function", "Stem", "Tense", "Voice", "Mood", "Form", "Type", "Person", "Case", "Gender", "Number", "State", "Degree"];

/** "Function=Verb; Stem=Qal; Form=Perfect; Person=Third; …" → "Verb · Qal · Perfect · 3rd person · …" */
export function describeSegment(expansion: string): string {
  const pairs = new Map<string, string>();
  for (const part of expansion.split(";")) {
    const [k, ...rest] = part.split("=");
    const v = rest.join("=").trim();
    if (k?.trim() && v) pairs.set(k.trim(), v);
  }
  const keys = [...pairs.keys()].sort((a, b) => {
    const ia = ORDER.indexOf(a);
    const ib = ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return keys
    .map((k) => {
      const v = pairs.get(k)!;
      if (k === "Person") return `${{ First: "1st", Second: "2nd", Third: "3rd" }[v] ?? v} person`;
      return v;
    })
    .join(" · ");
}

/** Morphology segments of a full code: "HR/Ncfsa" → ["HR", "HNcfsa"]; "P-1NS + CONJ" → two parts. */
export function morphSegments(code: string): string[] {
  if (/^[HA]/.test(code)) {
    const lang = code[0];
    return code.slice(1).split("/").filter(Boolean).map((s) => lang + s);
  }
  return code.split(" + ");
}

export function describeMorph(code: string | null, table: Record<string, string>): string | null {
  if (!code) return null;
  const parts = morphSegments(code).map((s) => (table[s] ? describeSegment(table[s]) : s));
  return parts.join("  +  ");
}
