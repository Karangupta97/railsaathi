import { cn } from "@/lib/cn";

/**
 * RailSaathi logo mark: a stylised shield with a train/track motif.
 * Decorative, so it is aria-hidden; the wordmark or button label carries the
 * accessible name.
 */
export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <path
        d="M16 2.5 27 6.2v8.3c0 6.9-4.6 12.4-11 15-6.4-2.6-11-8.1-11-15V6.2L16 2.5Z"
        className="fill-primary"
      />
      <path
        d="M12 11h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z"
        className="fill-[color-mix(in_oklab,white_92%,transparent)]"
      />
      <circle cx="13.3" cy="17.4" r="1.15" className="fill-primary" />
      <circle cx="18.7" cy="17.4" r="1.15" className="fill-primary" />
      <path d="M13 21.2l-1.4 2.2M19 21.2l1.4 2.2" className="stroke-primary" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12.5 13.6h7" className="stroke-primary" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
