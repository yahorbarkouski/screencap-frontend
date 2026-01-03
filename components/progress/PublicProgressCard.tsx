"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { formatTime } from "@/lib/utils/date";
import type { PublicEventResponse } from "@/lib/db/types";

interface PublicProgressCardProps {
  event: PublicEventResponse;
  isLast?: boolean;
}

export function PublicProgressCard({ event, isLast = false }: PublicProgressCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-[96px,1fr] gap-4">
        <div className="relative">
          <div className="pr-4 pt-1 text-right font-mono text-[11px] tracking-[0.18em] text-muted-foreground">
            {formatTime(event.timestampMs)}
          </div>
          <div className="absolute -right-0.5 top-2 h-2 w-2 rounded-full bg-gold" />
          {!isLast && (
            <div className="absolute right-[2px] top-5 -bottom-7 w-px bg-gold/40" />
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative overflow-hidden rounded-xl border border-border bg-card text-left cursor-pointer hover:border-gold/40 transition-colors"
        >
          <div className="relative aspect-video bg-muted">
            <img
              src={event.imageUrl}
              alt={event.caption || "Progress screenshot"}
              className="h-full w-full object-cover"
              loading="lazy"
            />

            {event.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4">
                <div className="truncate text-sm font-medium text-white/90">
                  {event.caption}
                </div>
              </div>
            )}
          </div>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative z-10 max-w-5xl w-full max-h-[90vh] overflow-auto rounded-xl border border-border bg-card"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur p-4">
                <div className="text-sm text-muted-foreground">
                  {formatTime(event.timestampMs)}
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="p-2">
                <img
                  src={event.imageUrl}
                  alt={event.caption || "Progress screenshot"}
                  className="w-full h-auto rounded-lg"
                />
              </div>
              {event.caption && (
                <div className="border-t border-border p-4">
                  <p className="text-sm text-foreground">{event.caption}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
