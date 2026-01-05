import { sql } from "@vercel/postgres";

export type FriendRequestStatus = "pending" | "accepted" | "rejected";

export type DbFriendRequest = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: FriendRequestStatus;
  created_at: Date;
  responded_at: Date | null;
};

export type FriendRequestView = {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  status: FriendRequestStatus;
  createdAt: number;
  respondedAt: number | null;
};

export type AvatarSettings = {
  pattern: "ascii";
  backgroundColor: string;
  foregroundColor: string;
  asciiChar?: string;
} | null;

function normalizeAvatarSettings(value: unknown): AvatarSettings {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const backgroundColor =
    typeof obj.backgroundColor === "string" ? obj.backgroundColor : null;
  const foregroundColor =
    typeof obj.foregroundColor === "string" ? obj.foregroundColor : null;
  if (!backgroundColor || !foregroundColor) return null;

  const asciiChar =
    typeof obj.asciiChar === "string" && /^[\x21-\x7E]$/.test(obj.asciiChar)
      ? obj.asciiChar
      : undefined;

  return {
    pattern: "ascii",
    backgroundColor,
    foregroundColor,
    ...(asciiChar ? { asciiChar } : {}),
  };
}

export type FriendView = {
  userId: string;
  username: string;
  deviceId: string | null;
  dhPubKey: string | null;
  avatarSettings: AvatarSettings;
  createdAt: number;
};

export async function getFriendRequestById(
  requestId: string
): Promise<DbFriendRequest | null> {
  const result = await sql<DbFriendRequest>`
    SELECT id, from_user_id, to_user_id, status, created_at, responded_at
    FROM friend_requests
    WHERE id = ${requestId}
  `;
  return result.rows[0] ?? null;
}

export async function getPendingReverseFriendRequest(params: {
  fromUserId: string;
  toUserId: string;
}): Promise<DbFriendRequest | null> {
  const result = await sql<DbFriendRequest>`
    SELECT id, from_user_id, to_user_id, status, created_at, responded_at
    FROM friend_requests
    WHERE from_user_id = ${params.toUserId}
      AND to_user_id = ${params.fromUserId}
      AND status = 'pending'
  `;
  return result.rows[0] ?? null;
}

export async function upsertPendingFriendRequest(params: {
  requestId: string;
  fromUserId: string;
  toUserId: string;
}): Promise<DbFriendRequest> {
  const result = await sql<DbFriendRequest>`
    INSERT INTO friend_requests (id, from_user_id, to_user_id, status)
    VALUES (${params.requestId}, ${params.fromUserId}, ${params.toUserId}, 'pending')
    ON CONFLICT (from_user_id, to_user_id) DO UPDATE SET
      status = 'pending',
      created_at = NOW(),
      responded_at = NULL
    RETURNING id, from_user_id, to_user_id, status, created_at, responded_at
  `;
  return result.rows[0];
}

export async function listFriendRequestsForUser(
  userId: string
): Promise<FriendRequestView[]> {
  const result = await sql<{
    id: string;
    from_user_id: string;
    to_user_id: string;
    status: FriendRequestStatus;
    created_at: Date;
    responded_at: Date | null;
    from_username: string;
    to_username: string;
  }>`
    SELECT
      fr.id,
      fr.from_user_id,
      fr.to_user_id,
      fr.status,
      fr.created_at,
      fr.responded_at,
      fu.username AS from_username,
      tu.username AS to_username
    FROM friend_requests fr
    JOIN users fu ON fu.id = fr.from_user_id
    JOIN users tu ON tu.id = fr.to_user_id
    WHERE fr.from_user_id = ${userId} OR fr.to_user_id = ${userId}
    ORDER BY fr.created_at DESC
  `;

  return result.rows.map((r) => ({
    id: r.id,
    fromUserId: r.from_user_id,
    fromUsername: r.from_username,
    toUserId: r.to_user_id,
    toUsername: r.to_username,
    status: r.status,
    createdAt: r.created_at.getTime(),
    respondedAt: r.responded_at ? r.responded_at.getTime() : null,
  }));
}

export async function acceptFriendRequest(params: {
  requestId: string;
  userId: string;
}): Promise<void> {
  const request = await getFriendRequestById(params.requestId);
  if (!request) {
    throw new Error("Friend request not found");
  }

  if (request.to_user_id !== params.userId) {
    throw new Error("Not authorized to accept this request");
  }

  if (request.status !== "pending") {
    throw new Error("Friend request is not pending");
  }

  await sql`
    UPDATE friend_requests
    SET status = 'accepted', responded_at = NOW()
    WHERE id = ${params.requestId}
  `;

  const [userA, userB] = [request.from_user_id, request.to_user_id].sort();
  await sql`
    INSERT INTO friendships (user_a, user_b)
    VALUES (${userA}, ${userB})
    ON CONFLICT (user_a, user_b) DO NOTHING
  `;
}

export async function rejectFriendRequest(params: {
  requestId: string;
  userId: string;
}): Promise<void> {
  const request = await getFriendRequestById(params.requestId);
  if (!request) {
    throw new Error("Friend request not found");
  }

  if (request.to_user_id !== params.userId) {
    throw new Error("Not authorized to reject this request");
  }

  if (request.status !== "pending") {
    throw new Error("Friend request is not pending");
  }

  await sql`
    UPDATE friend_requests
    SET status = 'rejected', responded_at = NOW()
    WHERE id = ${params.requestId}
  `;
}

export async function listFriends(userId: string): Promise<FriendView[]> {
  const result = await sql<{
    friend_user_id: string;
    username: string;
    device_id: string | null;
    dh_pub_key: string | null;
    avatar_settings: AvatarSettings;
    created_at: Date;
  }>`
    SELECT
      CASE WHEN f.user_a = ${userId} THEN f.user_b ELSE f.user_a END AS friend_user_id,
      u.username,
      d.id AS device_id,
      d.dh_pub_key,
      u.avatar_settings,
      f.created_at
    FROM friendships f
    JOIN users u
      ON u.id = CASE WHEN f.user_a = ${userId} THEN f.user_b ELSE f.user_a END
    LEFT JOIN LATERAL (
      SELECT id, dh_pub_key
      FROM user_devices
      WHERE user_id = u.id
      ORDER BY created_at ASC
      LIMIT 1
    ) d ON TRUE
    WHERE f.user_a = ${userId} OR f.user_b = ${userId}
    ORDER BY u.username ASC
  `;

  return result.rows.map((r) => ({
    userId: r.friend_user_id,
    username: r.username,
    deviceId: r.device_id,
    dhPubKey: r.dh_pub_key,
    avatarSettings: normalizeAvatarSettings(r.avatar_settings),
    createdAt: r.created_at.getTime(),
  }));
}

export async function areFriends(params: {
  userIdA: string;
  userIdB: string;
}): Promise<boolean> {
  const [userA, userB] = [params.userIdA, params.userIdB].sort();
  const result = await sql<{ ok: number }>`
    SELECT 1 AS ok
    FROM friendships
    WHERE user_a = ${userA} AND user_b = ${userB}
    LIMIT 1
  `;
  return (result.rows[0]?.ok ?? 0) === 1;
}

