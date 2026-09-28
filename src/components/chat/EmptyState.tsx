import { Logo } from "@/components/Logo";
import type { ChatStrings } from "@/lib/i18n";
import { SuggestionChips } from "./SuggestionChips";

/**
 * First-load welcome with localised starter prompts. Selecting a starter sends
 * it as the first user message.
 */
export function EmptyState({ strings, onSelect }: { strings: ChatStrings; onSelect: (text: string) => void }) {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-center px-4 py-10 text-center sm:py-16">
      <span className="grid size-14 place-items-center rounded-2xl border border-border bg-surface shadow-soft">
        <Logo size={32} />
      </span>
      <h1 className="mt-5 font-display text-2xl font-bold text-foreground">{strings.welcomeTitle}</h1>
      <p className="mt-2 max-w-md text-muted">{strings.welcomeBody}</p>

      <div className="mt-8 w-full">
        <h2 className="sr-only">{strings.startersLabel}</h2>
        <div className="flex justify-center">
          <SuggestionChips items={[...strings.starters]} onSelect={onSelect} label={strings.startersLabel} />
        </div>
      </div>
    </div>
  );
}
