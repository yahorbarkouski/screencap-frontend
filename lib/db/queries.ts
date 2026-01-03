import { sql } from "@vercel/postgres";
import type {
  PublishedProject,
  PublishedProjectEvent,
} from "./types";

export async function getProjectById(
  id: string
): Promise<PublishedProject | null> {
  const result = await sql<PublishedProject>`
    SELECT id, name, created_at, updated_at, last_event_at
    FROM published_projects
    WHERE id = ${id}
  `;
  return result.rows[0] ?? null;
}

export async function createProject(
  id: string,
  name: string,
  writeKeyHash: string
): Promise<PublishedProject> {
  const result = await sql<PublishedProject>`
    INSERT INTO published_projects (id, name)
    VALUES (${id}, ${name})
    RETURNING id, name, created_at, updated_at, last_event_at
  `;

  await sql`
    INSERT INTO published_project_secrets (project_id, write_key_hash)
    VALUES (${id}, ${writeKeyHash})
  `;

  return result.rows[0];
}

export async function getWriteKeyHash(
  projectId: string
): Promise<string | null> {
  const result = await sql<{ write_key_hash: string }>`
    SELECT write_key_hash
    FROM published_project_secrets
    WHERE project_id = ${projectId}
  `;
  return result.rows[0]?.write_key_hash ?? null;
}

export async function upsertEvent(
  event: Omit<PublishedProjectEvent, "created_at" | "updated_at">
): Promise<PublishedProjectEvent> {
  const result = await sql<PublishedProjectEvent>`
    INSERT INTO published_project_events (id, project_id, timestamp_ms, caption, image_url)
    VALUES (${event.id}, ${event.project_id}, ${event.timestamp_ms}, ${event.caption}, ${event.image_url})
    ON CONFLICT (id) DO UPDATE SET
      caption = EXCLUDED.caption,
      image_url = EXCLUDED.image_url,
      updated_at = NOW()
    RETURNING id, project_id, timestamp_ms, caption, image_url, created_at, updated_at
  `;

  await sql`
    UPDATE published_projects
    SET last_event_at = NOW(), updated_at = NOW()
    WHERE id = ${event.project_id}
  `;

  return result.rows[0];
}

export async function getEventsByProject(
  projectId: string,
  options?: {
    before?: number;
    limit?: number;
  }
): Promise<PublishedProjectEvent[]> {
  const limit = options?.limit ?? 50;
  const before = options?.before;

  if (before) {
    const result = await sql<PublishedProjectEvent>`
      SELECT id, project_id, timestamp_ms, caption, image_url, created_at, updated_at
      FROM published_project_events
      WHERE project_id = ${projectId} AND timestamp_ms < ${before}
      ORDER BY timestamp_ms DESC
      LIMIT ${limit}
    `;
    return result.rows;
  }

  const result = await sql<PublishedProjectEvent>`
    SELECT id, project_id, timestamp_ms, caption, image_url, created_at, updated_at
    FROM published_project_events
    WHERE project_id = ${projectId}
    ORDER BY timestamp_ms DESC
    LIMIT ${limit}
  `;
  return result.rows;
}

export async function getEventsSince(
  projectId: string,
  since: number,
  limit: number = 100
): Promise<PublishedProjectEvent[]> {
  const result = await sql<PublishedProjectEvent>`
    SELECT id, project_id, timestamp_ms, caption, image_url, created_at, updated_at
    FROM published_project_events
    WHERE project_id = ${projectId} AND timestamp_ms > ${since}
    ORDER BY timestamp_ms DESC
    LIMIT ${limit}
  `;
  return result.rows;
}
