"use client";

import { Phone, Siren, X } from "lucide-react";
import { HELPLINES } from "@/lib/helplines";
import type { ChatStrings } from "@/lib/i18n";

/**
 * High-contrast emergency banner, shown when urgency keywords are detected
 * (client-side and via the x-urgency header) — never dependent on LLM text.
 * Large tap-to-call targets for every helpline; dismissible but re-appears on
 * the next urgent message.
 */
export function EmergencyBanner({ strings, onDismiss }: { strings: ChatStrings; onDismiss: () => void }) {
  return (
    <section
      role="alert"
      aria-label={strings.banner.title}
      className="animate-fade-in rounded-2xl border border-emergency/40 bg-emergency/10 p-4 shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emergency text-white">
            <Siren className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-emergency-ink">{strings.banner.title}</h2>
            <p className="text-sm text-foreground">{strings.banner.body}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={strings.banner.dismiss}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-emergency-ink transition-colors hover:bg-emergency/10"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {HELPLINES.map((h) => (
          <li key={h.number}>
            <a
              href={`tel:${h.number}`}
              className="flex h-full flex-col items-start gap-0.5 rounded-xl bg-emergency px-3 py-2.5 text-white transition-colors hover:bg-emergency-strong"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium opacity-90">
                <Phone className="size-3.5" aria-hidden="true" />
                {h.name}
              </span>
              <span className="font-mono text-lg font-bold tabular-nums">{h.number}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-emergency-ink/80">{strings.banner.verify}</p>
    </section>
  );
}
