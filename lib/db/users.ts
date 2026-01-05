import { sql } from "@vercel/postgres";

export type AvatarPattern =
  | "letter"
  | "letterBold"
  | "letterMonospace"
  | "pixelLetter"
  | "ascii";

export type AvatarSettings = {
  pattern: AvatarPattern;
  backgroundColor: string;
  foregroundColor: string;
};

export type DbUser = {
  id: string;
  username: string;
  avatar_settings: AvatarSettings | null;
  created_at: Date;
};

export type DbUserDevice = {
  id: string;
  user_id: string;
  sign_pub_key: string;
  dh_pub_key: string;
  created_at: Date;
  last_seen_at: Date | null;
};

export async function getUserById(userId: string): Promise<DbUser | null> {
  const result = await sql<DbUser>`
    SELECT id, username, avatar_settings, created_at
    FROM users
    WHERE id = ${userId}
  `;
  return result.rows[0] ?? null;
}

export async function getUserByUsername(
  username: string
): Promise<DbUser | null> {
  const result = await sql<DbUser>`
    SELECT id, username, avatar_settings, created_at
    FROM users
    WHERE username = ${username}
  `;
  return result.rows[0] ?? null;
}

export async function createUserWithDevice(params: {
  userId: string;
  deviceId: string;
  username: string;
  signPubKey: string;
  dhPubKey: string;
}): Promise<{ user: DbUser; device: DbUserDevice }> {
  const userResult = await sql<DbUser>`
    INSERT INTO users (id, username)
    VALUES (${params.userId}, ${params.username})
    RETURNING id, username, created_at
  `;

  const deviceResult = await sql<DbUserDevice>`
    INSERT INTO user_devices (id, user_id, sign_pub_key, dh_pub_key)
    VALUES (${params.deviceId}, ${params.userId}, ${params.signPubKey}, ${params.dhPubKey})
    RETURNING id, user_id, sign_pub_key, dh_pub_key, created_at, last_seen_at
  `;

  return { user: userResult.rows[0], device: deviceResult.rows[0] };
}

export async function renameUser(params: {
  userId: string;
  username: string;
}): Promise<DbUser> {
  const result = await sql<DbUser>`
    UPDATE users
    SET username = ${params.username}
    WHERE id = ${params.userId}
    RETURNING id, username, created_at
  `;
  const row = result.rows[0];
  if (!row) {
    throw new Error("User not found");
  }
  return row;
}

export async function listUserDevices(userId: string): Promise<DbUserDevice[]> {
  const result = await sql<DbUserDevice>`
    SELECT id, user_id, sign_pub_key, dh_pub_key, created_at, last_seen_at
    FROM user_devices
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `;
  return result.rows;
}

export async function updateUserAvatarSettings(params: {
  userId: string;
  avatarSettings: AvatarSettings;
}): Promise<DbUser> {
  const result = await sql<DbUser>`
    UPDATE users
    SET avatar_settings = ${JSON.stringify(params.avatarSettings)}::jsonb
    WHERE id = ${params.userId}
    RETURNING id, username, avatar_settings, created_at
  `;
  const row = result.rows[0];
  if (!row) {
    throw new Error("User not found");
  }
  return row;
}
