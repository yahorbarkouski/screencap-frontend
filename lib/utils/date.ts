import { format, isToday, isYesterday, startOfDay, subDays, endOfDay } from "date-fns";

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d, yyyy");
}

export function formatTime(timestamp: number): string {
  return format(new Date(timestamp), "h:mm a");
}

export function formatFullTime(timestamp: number): string {
  return format(new Date(timestamp), "MMM d, h:mm a");
}

export type RangePreset = "today" | "7d" | "30d" | "all";

export function rangeBounds(preset: RangePreset): {
  startDate?: number;
  endDate?: number;
} {
  if (preset === "all") return {};
  const now = new Date();
  const endDate = endOfDay(now).getTime();
  if (preset === "today") return { startDate: startOfDay(now).getTime(), endDate };
  const days = preset === "7d" ? 6 : 29;
  const startDate = startOfDay(subDays(now, days)).getTime();
  return { startDate, endDate };
}

export function groupByDate<T extends { timestampMs: number }>(
  items: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const date = formatDate(item.timestampMs);
    const existing = groups.get(date) || [];
    existing.push(item);
    groups.set(date, existing);
  }
  return groups;
}
