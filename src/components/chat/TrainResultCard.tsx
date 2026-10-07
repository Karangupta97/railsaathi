"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, Clock, TrainFront } from "lucide-react";
import { cn } from "@/lib/cn";
import type { TrainsPayload } from "@/lib/chat-types";
import type { ChatStrings } from "@/lib/i18n";
import type { ServiceType, TrainResult, TrainDetails } from "@/lib/timetable/types";
import { nowInIST, toMinutes } from "@/lib/timetable/time";

/**
 * Renders the [[TRAINS]] payload under an assistant bubble: a "Scheduled" badge,
 * the first departure highlighted with a live countdown, and expandable stops.
 * Times come only from tool data. Uses accessible table semantics.
 */
export function TrainResultCard({ payload, strings }: { payload: TrainsPayload; strings: ChatStrings }) {
  const { result } = payload;
  if (!result.covered) return null;

  const date = payload.effectiveFrom ?? formatDate(payload.syncedAt);

  if (result.direct) {
    return (
      <Card from={payload.from} to={payload.to} strings={strings} source={payload.sourceName} date={date}>
        <TrainTable trains={result.trains} strings={strings} />
      </Card>
    );
  }

  // Interchange: show the first option's two legs.
  const opt = result.interchange_options[0];
  if (!opt) return null;
  return (
    <Card from={payload.from} to={payload.to} strings={strings} source={payload.sourceName} date={date}>
      <TrainTable trains={opt.leg1} strings={strings} />
      <p className="my-2 flex items-center gap-1.5 text-xs font-medium text-accent-ink">
        {strings.trains.changeAt} {opt.change_at_name}
      </p>
      <TrainTable trains={opt.leg2} strings={strings} />
    </Card>
  );
}

function Card({
  from,
  to,
  source,
  date,
  strings,
  children,
}: {
  from: string;
  to: string;
  source: string;
  date: string;
  strings: ChatStrings;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface" aria-label={`${from} to ${to}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-muted px-4 py-2.5">
        <TrainFront className="size-4 text-primary-ink" aria-hidden="true" />
        <span className="flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
          {from} <ArrowRight className="size-3.5 text-muted" aria-hidden="true" /> {to}
        </span>
        <span className="ml-auto rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-ink">
          {strings.trains.scheduled}
        </span>
      </header>
      <div className="p-3">{children}</div>
      <p className="border-t border-border px-4 py-2 text-xs text-muted">{strings.trains.footnote(source, date)}</p>
    </section>
  );
}

function TrainTable({ trains, strings }: { trains: TrainResult[]; strings: ChatStrings }) {
  if (trains.length === 0) return <p className="px-1 py-2 text-sm text-muted">{strings.trains.noData}</p>;
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">
        {strings.trains.departs} / {strings.trains.arrives}
      </caption>
      <thead>
        <tr className="text-left text-xs text-muted">
          <th scope="col" className="py-1 pl-1 font-medium">
            {strings.trains.departs}
          </th>
          <th scope="col" className="py-1 font-medium">
            {strings.trains.arrives}
          </th>
          <th scope="col" className="py-1 font-medium">
            {strings.trains.duration}
          </th>
          <th scope="col" className="py-1 font-medium">
            {strings.trains.plat}
          </th>
        </tr>
      </thead>
      <tbody>
        {trains.map((t, i) => (
          <TrainRow key={`${t.trip_id}-${i}`} train={t} highlight={i === 0} strings={strings} />
        ))}
      </tbody>
    </table>
  );
}

function TrainRow({ train, highlight, strings }: { train: TrainResult; highlight: boolean; strings: ChatStrings }) {
  const [expanded, setExpanded] = useState(false);
  const [stops, setStops] = useState<TrainDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const countdown = useCountdown(train.departure);

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !stops) {
      setLoading(true);
      try {
        const res = await fetch(`/api/train?trip_id=${encodeURIComponent(train.trip_id)}`);
        setStops((await res.json()) as TrainDetails);
      } catch {
        setStops({ found: false });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <>
      <tr className={cn("border-t border-border align-middle", highlight && "bg-primary-soft/40")}>
        <td className="py-2 pl-1">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            className="flex min-h-[44px] items-center gap-1.5 font-mono text-[15px] font-semibold text-foreground"
          >
            {train.departure}
            <ChevronDown className={cn("size-4 text-muted transition-transform", expanded && "rotate-180")} aria-hidden="true" />
          </button>
          {highlight && (
            <span className="flex items-center gap-1 text-xs font-medium text-primary-ink">
              <Clock className="size-3" aria-hidden="true" />
              {strings.trains.nextIn(countdown)}
            </span>
          )}
        </td>
        <td className="py-2 font-mono text-[15px]">{train.arrival}</td>
        <td className="py-2 text-muted">
          {train.duration_min} {strings.trains.minutes}
        </td>
        <td className="py-2">
          <ServiceChip type={train.service_type} strings={strings} />
          {train.platform && <span className="ml-1 font-mono text-xs text-muted">{train.platform}</span>}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} className="bg-surface-muted px-2 py-2">
            {loading ? (
              <p className="text-xs text-muted">…</p>
            ) : stops?.found ? (
              <ol className="space-y-1">
                {stops.stops.map((s) => (
                  <li key={s.code} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{s.name}</span>
                    <span className="font-mono text-muted">{s.departure ?? s.arrival ?? "—"}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted">{strings.trains.noData}</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ServiceChip({ type, strings }: { type: ServiceType; strings: ChatStrings }) {
  const label = strings.trains.serviceTypes[type];
  const tone =
    type === "fast" || type === "semi_fast"
      ? "bg-accent/15 text-accent-ink"
      : type === "ac"
        ? "bg-primary-soft text-primary-ink"
        : "bg-surface-muted text-muted";
  return <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", tone)}>{label}</span>;
}

/** Minutes until `hhmm` in IST, recomputed each minute. */
function useCountdown(hhmm: string): number {
  const compute = () => toMinutes(hhmm) - nowInIST().minutes;
  const [mins, setMins] = useState(compute);
  useEffect(() => {
    const id = setInterval(() => setMins(compute()), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hhmm]);
  return mins;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}
