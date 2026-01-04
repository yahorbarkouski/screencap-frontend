"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Radio } from "lucide-react";
import { PublicProgressTimelineGroup } from "./PublicProgressTimelineGroup";
import { groupByDate, rangeBounds, type RangePreset } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { PublicEventResponse, PublicProjectResponse } from "@/lib/db/types";
import type { PublicDecryptedEvent } from "./types";

const POLL_INTERVAL = 8000;

interface PublicProgressViewProps {
  project: PublicProjectResponse;
  initialEvents: PublicEventResponse[];
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

export function PublicProgressView({
  project,
  initialEvents,
}: PublicProgressViewProps) {
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [events, setEvents] = useState<PublicEventResponse[]>(initialEvents);
  const [decryptedEvents, setDecryptedEvents] = useState<PublicDecryptedEvent[]>([]);
  const [roomKey, setRoomKey] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const imageUrlCache = useRef<Map<string, string>>(new Map());

  const decodeBase64 = useCallback((b64: string): Uint8Array => {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }, []);

  const decodeBase64Url = useCallback(
    (b64url: string): Uint8Array => {
      const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
      return decodeBase64(`${b64}${pad}`);
    },
    [decodeBase64]
  );

  const parseRoomKeyFromHash = useCallback((): Uint8Array | null => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash.startsWith("k=") ? hash : hash.replace(/^#/, ""));
    const k = params.get("k");
    if (!k) return null;
    try {
      const bytes = decodeBase64Url(k);
      return bytes.length === 32 ? bytes : null;
    } catch {
      return null;
    }
  }, [decodeBase64Url]);

  const deriveAesKey = useCallback(async (info: string) => {
    if (!roomKey) throw new Error("Missing room key");
    const ikm = await crypto.subtle.importKey("raw", toArrayBuffer(roomKey), "HKDF", false, [
      "deriveBits",
    ]);
    const bits = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(),
        info: new TextEncoder().encode(info),
      },
      ikm,
      256
    );
    return await crypto.subtle.importKey(
      "raw",
      bits,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  }, [roomKey]);

  const decryptAesGcm = useCallback(
    async (key: CryptoKey, ciphertextB64: string): Promise<Uint8Array> => {
      const data = decodeBase64(ciphertextB64);
      if (data.length < 12 + 16) throw new Error("Ciphertext too short");
      const nonce = data.slice(0, 12);
      const cipherWithTag = data.slice(12);
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce },
        key,
        cipherWithTag
      );
      return new Uint8Array(plaintext);
    },
    [decodeBase64]
  );

  const decryptImageToObjectUrl = useCallback(
    async (key: CryptoKey, imageUrl: string, mime: string): Promise<string> => {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error("Image fetch failed");
      const data = new Uint8Array(await res.arrayBuffer());
      if (data.length < 12 + 16) throw new Error("Ciphertext too short");
      const nonce = data.slice(0, 12);
      const cipherWithTag = data.slice(12);
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce },
        key,
        cipherWithTag
      );
      return URL.createObjectURL(new Blob([plaintext], { type: mime }));
    },
    []
  );

  useEffect(() => {
    const update = () => setRoomKey(parseRoomKeyFromHash());
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, [parseRoomKeyFromHash]);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/published-projects/${project.id}/events?limit=100`
      );
      if (!response.ok) return;
      const data: PublicEventResponse[] = await response.json();
      setEvents(data);
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setIsLoading(false);
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
    } catch (error) {
      console.error("Failed to fetch new events:", error);
    }
  }, [events, fetchEvents, project.id]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!roomKey) {
        setDecryptedEvents([]);
        return;
      }

      const eventKey = await deriveAesKey("room-event");
      const imageKey = await deriveAesKey("room-image");

      const base = await Promise.all(
        events.map(async (e) => {
          const payloadBytes = await decryptAesGcm(eventKey, e.payloadCiphertext);
          const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as {
            caption?: string | null;
            image?: { ref?: string | null; mime?: string | null };
          };

          const caption =
            typeof payload?.caption === "string" ? payload.caption : null;
          const imageRef =
            typeof payload?.image?.ref === "string" ? payload.image.ref : e.imageUrl;
          const mime =
            typeof payload?.image?.mime === "string" && payload.image.mime
              ? payload.image.mime
              : "image/webp";

          const cached = imageUrlCache.current.get(e.id) ?? null;
          return { id: e.id, timestampMs: e.timestampMs, caption, imageRef, mime, cached };
        })
      );

      if (cancelled) return;
      setDecryptedEvents(
        base.map((e) => ({
          id: e.id,
          timestampMs: e.timestampMs,
          caption: e.caption,
          imageUrl: e.cached,
        }))
      );

      for (const e of base) {
        if (!e.imageRef) continue;
        if (imageUrlCache.current.has(e.id)) continue;
        try {
          const objectUrl = await decryptImageToObjectUrl(imageKey, e.imageRef, e.mime);
          if (cancelled) return;
          imageUrlCache.current.set(e.id, objectUrl);
          setDecryptedEvents((prev) =>
            prev.map((p) => (p.id === e.id ? { ...p, imageUrl: objectUrl } : p))
          );
        } catch {}
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [decryptAesGcm, decryptImageToObjectUrl, deriveAesKey, events, roomKey]);

  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(fetchNewEvents, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNewEvents, isLive]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    const { startDate, endDate } = rangeBounds(preset);
    return decryptedEvents.filter((e) => {
      if (startDate && e.timestampMs < startDate) return false;
      if (endDate && e.timestampMs > endDate) return false;
      return true;
    });
  }, [decryptedEvents, preset]);

  const groupedEvents = useMemo(
    () => groupByDate(filteredEvents),
    [filteredEvents]
  );

  if (!roomKey) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-lg border border-border bg-muted/10 p-4">
          <div className="text-sm font-medium text-foreground">
            This share link is encrypted
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Open the link that includes the decryption key in the URL fragment.
          </div>
        </div>
      </div>
    );
  }

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
