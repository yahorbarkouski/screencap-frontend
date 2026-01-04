import { sql } from "@vercel/postgres";

export class RateLimitError extends Error {
  readonly status = 429;
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Rate limit exceeded");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function getClientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

export async function enforceRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<void> {
  const baseKey = params.key.trim();
  if (!baseKey || baseKey.length > 200) {
    throw new Error("Invalid rate limit key");
  }
  if (!Number.isFinite(params.limit) || params.limit <= 0) {
    throw new Error("Invalid rate limit");
  }
  if (!Number.isFinite(params.windowMs) || params.windowMs < 1000) {
    throw new Error("Invalid rate limit window");
  }

  const now = Date.now();
  const bucket = Math.floor(now / params.windowMs);
  const bucketKey = `${baseKey}:${bucket}`;

  const result = await sql<{ count: number }>`
    INSERT INTO rate_limits (key, count)
    VALUES (${bucketKey}, 1)
    ON CONFLICT (key) DO UPDATE SET
      count = rate_limits.count + 1
    RETURNING count
  `;

  const count = Number(result.rows[0]?.count ?? 0);
  if (count <= params.limit) return;

  const resetAt = (bucket + 1) * params.windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
  throw new RateLimitError(retryAfterSeconds);
}

