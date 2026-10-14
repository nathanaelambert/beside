"use client";
import { useEffect, useId, useRef, useState } from "react";

export function MermaidDiagram({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const container = ref.current;
    if (container) container.textContent = "Rendering the working model…";
    async function render() {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          layout: "dagre",
          look: "classic",
          fontFamily: "sans-serif",
          themeVariables: {
            primaryColor: "#f5f4ed",
            lineColor: "#787d6e",
            fontSize: "13px",
          },
          er: { useMaxWidth: true },
        });
        const result = await mermaid.render(
          `erd${uniqueId}${Date.now()}`,
          source,
        );
        if (!cancelled && container) {
          container.innerHTML = result.svg;
          result.bindFunctions?.(container);
          setError(null);
        }
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Could not render diagram.",
          );
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [source, uniqueId]);
  return (
    <>
      <div
        className="mermaid-canvas"
        ref={ref}
        aria-label="Rendered entity relationship diagram"
        role="img"
      />
      {error && (
        <p className="error">
          Diagram error: {error}. The Mermaid source below remains available.
        </p>
      )}
    </>
  );
}
