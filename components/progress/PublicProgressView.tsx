"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Radio } from "lucide-react";
import { PublicProgressTimelineGroup } from "./PublicProgressTimelineGroup";
import { groupByDate, rangeBounds, type RangePreset } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { PublicEventResponse, PublicProjectResponse } from "@/lib/db/types";

const POLL_INTERVAL = 8000;

interface PublicProgressViewProps {
  project: PublicProjectResponse;
  initialEvents: PublicEventResponse[];
}

export function PublicProgressView({
  project,
  initialEvents,
}: PublicProgressViewProps) {
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [events, setEvents] = useState<PublicEventResponse[]>(initialEvents);
  const [isLoading, setIsLoading] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [lastPolled, setLastPolled] = useState<number>(Date.now());

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/published-projects/${project.id}/events?limit=100`
      );
      if (!response.ok) return;
      const data: PublicEventResponse[] = await response.json();
      setEvents(data);
      setLastPolled(Date.now());
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  }, [project.id]);

  const fetchNewEvents = useCallback(async () => {
    if (events.length === 0) {
      await fetchEvents();
      return;
    }

    const latestTimestamp = Math.max(...events.map((e) => e.timestampMs));
    try {
      const response = await fetch(
        `/api/published-projects/${project.id}/events?since=${latestTimestamp}&limit=50`
      );
      if (!response.ok) return;
      const newEvents: PublicEventResponse[] = await response.json();
      if (newEvents.length > 0) {
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const uniqueNew = newEvents.filter((e) => !existingIds.has(e.id));
          return [...uniqueNew, ...prev].sort(
            (a, b) => b.timestampMs - a.timestampMs
          );
        });
      }
      setLastPolled(Date.now());
    } catch (error) {
      console.error("Failed to fetch new events:", error);
    }
  }, [events, fetchEvents, project.id]);

  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(fetchNewEvents, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNewEvents, isLive]);

  useEffect(() => {
    setIsLoading(true);
    fetchEvents().finally(() => setIsLoading(false));
  }, [preset, fetchEvents]);

  const filteredEvents = useMemo(() => {
    const { startDate, endDate } = rangeBounds(preset);
    return events.filter((e) => {
      if (startDate && e.timestampMs < startDate) return false;
      if (endDate && e.timestampMs > endDate) return false;
      return true;
    });
  }, [events, preset]);

  const groupedEvents = useMemo(
    () => groupByDate(filteredEvents),
    [filteredEvents]
  );

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {project.name}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLive(!isLive)}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs transition-colors",
                    isLive ? "text-emerald-500" : "text-muted-foreground"
                  )}
                >
                  <Radio className={cn("size-3", isLive && "animate-pulse")} />
                  {isLive ? "Live" : "Paused"}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center rounded-md border border-input bg-muted/20 p-0.5">
                {(
                  [
                    { key: "today", label: "Today" },
                    { key: "7d", label: "7d" },
                    { key: "30d", label: "30d" },
                    { key: "all", label: "All" },
                  ] as const
                ).map((p) => {
                  const active = preset === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      className={cn(
                        "h-7 px-3 text-xs rounded transition-colors",
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setPreset(p.key)}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {isLoading ? (
          <div className="flex h-[40vh] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <motion.div
            className="flex h-[40vh] flex-col items-center justify-center text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-muted-foreground">
              No progress updates in this range.
            </p>
            <p className="mt-2 text-sm text-muted-foreground/70">
              Progress captures will appear here when shared from the desktop app.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {Array.from(groupedEvents.entries()).map(([date, dayEvents]) => (
              <PublicProgressTimelineGroup
                key={date}
                date={date}
                events={dayEvents}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
