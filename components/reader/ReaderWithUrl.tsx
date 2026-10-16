"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { parseReaderState, readerQuery, type ReaderState } from "@/lib/reader/state";
import { ParallelReader } from "./ParallelReader";
import type { ReaderProps } from "./types";

/** Binds the reader to `?t=…&v=…`. Render inside <Suspense> with a default-state fallback. */
export function ReaderWithUrl(props: ReaderProps) {
  const params = useSearchParams();
  const state = useMemo(() => parseReaderState(params, props.verses.length), [params, props.verses.length]);

  // replaceState keeps selection changes out of the back-button history; Next syncs useSearchParams.
  const setState = useCallback((next: ReaderState) => {
    window.history.replaceState(null, "", window.location.pathname + readerQuery(next));
  }, []);

  return <ParallelReader {...props} state={state} onStateChange={setState} />;
}
