import Link from "next/link";
import { ArrowRight, MessagesSquare, Phone } from "lucide-react";
import { Logo } from "@/components/Logo";
import { EMERGENCY_NUMBER, SITE_NAME } from "@/lib/site";

/**
 * Minimal home page. The full landing page is out of scope for this task; this
 * just gives the app an entry point that links into the /chat assistant.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[720px] flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="grid size-16 place-items-center rounded-2xl border border-border bg-surface shadow-soft">
        <Logo size={36} />
      </span>
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">{SITE_NAME}</h1>
        <p className="mt-3 text-lead text-muted">
          Calm, step-by-step safety guidance for Mumbai local train commuters.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/chat"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-on-primary transition-colors hover:bg-primary-hover"
        >
          <MessagesSquare className="size-5" aria-hidden="true" />
          Ask RailSaathi
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <a
          href={`tel:${EMERGENCY_NUMBER}`}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border px-5 font-semibold text-foreground transition-colors hover:bg-surface-muted"
        >
          <Phone className="size-5" aria-hidden="true" />
          Emergency <span className="font-mono">{EMERGENCY_NUMBER}</span>
        </a>
      </div>
    </main>
  );
}
