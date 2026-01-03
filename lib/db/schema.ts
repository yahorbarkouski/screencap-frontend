import { sql } from "@vercel/postgres";

export async function initializeDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS published_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_event_at TIMESTAMP WITH TIME ZONE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS published_project_secrets (
      project_id TEXT PRIMARY KEY REFERENCES published_projects(id) ON DELETE CASCADE,
      write_key_hash TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS published_project_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES published_projects(id) ON DELETE CASCADE,
      timestamp_ms BIGINT NOT NULL,
      caption TEXT,
      image_url TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_events_project_timestamp 
    ON published_project_events(project_id, timestamp_ms DESC)
  `;
}
