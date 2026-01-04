import { sql } from "@vercel/postgres";

export async function initializeDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sign_pub_key TEXT NOT NULL,
      dh_pub_key TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_seen_at TIMESTAMP WITH TIME ZONE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      responded_at TIMESTAMP WITH TIME ZONE,
      UNIQUE(from_user_id, to_user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS friendships (
      user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_a, user_b)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_blocks (
      blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(blocker_user_id, blocked_user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      visibility TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(room_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS room_invites (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      responded_at TIMESTAMP WITH TIME ZONE,
      UNIQUE(room_id, to_user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS room_member_keys (
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
      envelope_json TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(room_id, device_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS room_events (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      timestamp_ms BIGINT NOT NULL,
      payload_ciphertext TEXT NOT NULL,
      image_ref TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chat_threads (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chat_thread_members (
      thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(thread_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
      author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      timestamp_ms BIGINT NOT NULL,
      ciphertext TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

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
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_events_project_timestamp 
    ON published_project_events(project_id, timestamp_ms DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_devices_user_id
    ON user_devices(user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_friend_requests_to_status
    ON friend_requests(to_user_id, status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_friend_requests_from_status
    ON friend_requests(from_user_id, status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_friendships_user_a
    ON friendships(user_a)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_friendships_user_b
    ON friendships(user_b)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker
    ON user_blocks(blocker_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
    ON user_blocks(blocked_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_room_members_user_id
    ON room_members(user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_room_members_room_id
    ON room_members(room_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_room_invites_to_status
    ON room_invites(to_user_id, status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_room_invites_room_id
    ON room_invites(room_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_room_member_keys_device_id
    ON room_member_keys(device_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_room_events_room_timestamp
    ON room_events(room_id, timestamp_ms DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_chat_thread_members_user_id
    ON chat_thread_members(user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_timestamp
    ON chat_messages(thread_id, timestamp_ms DESC)
  `;
}
