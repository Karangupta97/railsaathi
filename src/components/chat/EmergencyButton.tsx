import { Siren } from "lucide-react";
import { cn } from "@/lib/cn";
import { EMERGENCY_NUMBER } from "@/lib/site";

/**
 * Always-visible tap-to-call emergency button. Icon is paired with a text
 * label (not colour alone). On very small screens the label collapses but the
 * accessible name stays via aria-label.
 */
export function EmergencyButton({ label, callLabel }: { label: string; callLabel: string }) {
  return (
    <a
      href={`tel:${EMERGENCY_NUMBER}`}
      aria-label={callLabel}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-xl bg-emergency px-3 font-semibold text-white shadow-soft",
        "transition-colors hover:bg-emergency-strong focus-visible:outline-offset-2",
      )}
    >
      <Siren className="size-5" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
      <span className="font-mono text-sm tabular-nums">{EMERGENCY_NUMBER}</span>
    </a>
  );
}
