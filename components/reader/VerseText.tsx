import { Fragment } from "react";

// LORD/GOD (the divine name, YHWH) are set in small caps by convention. Skip them inside
// all-caps runs such as inscriptions ("TO AN UNKNOWN GOD"), which keep their capitals.
const DIVINE_NAME = /(?<![A-Z]{2,}[^A-Za-z]{1,3})\b(LORD|GOD)\b(?![^A-Za-z]{1,3}[A-Z]{2,}\b)/g;

export function VerseText({ text }: { text: string }) {
  const parts = text.split(DIVINE_NAME);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="small-caps">
        {part[0] + part.slice(1).toLowerCase()}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
