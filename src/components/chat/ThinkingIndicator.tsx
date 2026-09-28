"use client";

import { useEffect, useState } from "react";
import type { ChatStrings } from "@/lib/i18n";

/**
 * The assistant "thinking" state: pulsing dots + a rotating status line that
 * reflects the pipeline stage. Driven by real progress via `stage` where
 * available (0 understand, 1 retrieve, 2 answer); otherwise it advances on a
 * timer. After ~8s it offers a cancel.
 *
 * Accessibility: role="status" + aria-live="polite" with a visually hidden
 * label. Under prefers-reduced-motion the dots hold still (CSS) and only the
 * text changes.
 */
export function ThinkingIndicator({
  strings,
  stage,
  onCancel,
}: {
  strings: ChatStrings;
  stage?: 0 | 1 | 2;
  onCancel: () => void;
}) {
  const [autoStage, setAutoStage] = useState(0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setAutoStage(1), 1200);
    const t2 = setTimeout(() => setAutoStage(2), 3200);
    const slowTimer = setTimeout(() => setSlow(true), 8000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(slowTimer);
    };
  }, []);

  const currentStage = stage ?? (autoStage as 0 | 1 | 2);
  const statusText = strings.thinkingStages[currentStage];

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <span className="sr-only">{strings.thinkingLabel}</span>
      <div className="flex items-center gap-3">
        <span className="flex items-end gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-2 rounded-full bg-primary [animation:var(--animate-dot)]"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </span>
        <span className="text-sm text-muted">{statusText}</span>
      </div>
      {slow && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{strings.thinkingSlow}</span>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-2 py-1 font-medium text-primary-ink underline underline-offset-2 hover:bg-surface-muted"
          >
            {strings.cancel}
          </button>
        </div>
      )}
    </div>
  );
}
