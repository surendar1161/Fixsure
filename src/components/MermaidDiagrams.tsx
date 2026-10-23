"use client";

import { useEffect } from "react";

/** Turns every `pre.mermaid` block inside `#{rootId}` into a diagram. */
export function MermaidDiagrams({ rootId }: { rootId: string }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nodes = document.querySelectorAll<HTMLElement>(`#${rootId} pre.mermaid:not([data-processed])`);
      if (!nodes.length) return;
      const { default: mermaid } = await import("mermaid");
      if (cancelled) return;
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", fontFamily: "inherit" });
      await mermaid.run({ nodes, suppressErrors: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [rootId]);

  return null;
}
