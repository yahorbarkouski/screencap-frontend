"use client";

import { useMemo } from "react";
import { PublicProgressCard } from "./PublicProgressCard";
import type { PublicEventResponse } from "@/lib/db/types";

interface PublicProgressTimelineGroupProps {
  date: string;
  events: PublicEventResponse[];
}

export function PublicProgressTimelineGroup({
  date,
  events,
}: PublicProgressTimelineGroupProps) {
  const ordered = useMemo(
    () => [...events].sort((a, b) => b.timestampMs - a.timestampMs),
    [events]
  );

  return (
    <div className="animate-fade-in">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{date}</h3>
      <div className="space-y-6">
        {ordered.map((event, idx) => (
          <PublicProgressCard
            key={event.id}
            event={event}
            isLast={idx === ordered.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
