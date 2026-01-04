import { sql } from "@vercel/postgres";

export type BlockedUserView = {
  userId: string;
  username: string;
  createdAt: number;
};

export async function blockUser(params: {
  blockerUserId: string;
  blockedUserId: string;
}): Promise<void> {
  await sql`
    INSERT INTO user_blocks (blocker_user_id, blocked_user_id)
    VALUES (${params.blockerUserId}, ${params.blockedUserId})
    ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING
  `;
}

export async function unblockUser(params: {
  blockerUserId: string;
  blockedUserId: string;
}): Promise<void> {
  await sql`
    DELETE FROM user_blocks
    WHERE blocker_user_id = ${params.blockerUserId}
      AND blocked_user_id = ${params.blockedUserId}
  `;
}

export async function isBlocked(params: {
  blockerUserId: string;
  blockedUserId: string;
}): Promise<boolean> {
  const result = await sql<{ ok: number }>`
    SELECT 1 AS ok
    FROM user_blocks
    WHERE blocker_user_id = ${params.blockerUserId}
      AND blocked_user_id = ${params.blockedUserId}
    LIMIT 1
  `;
  return (result.rows[0]?.ok ?? 0) === 1;
}

export async function isBlockedEitherWay(params: {
  userIdA: string;
  userIdB: string;
}): Promise<boolean> {
  const result = await sql<{ ok: number }>`
    SELECT 1 AS ok
    FROM user_blocks
    WHERE (blocker_user_id = ${params.userIdA} AND blocked_user_id = ${params.userIdB})
       OR (blocker_user_id = ${params.userIdB} AND blocked_user_id = ${params.userIdA})
    LIMIT 1
  `;
  return (result.rows[0]?.ok ?? 0) === 1;
}

export async function listBlockedUsers(params: {
  blockerUserId: string;
}): Promise<BlockedUserView[]> {
  const result = await sql<{
    user_id: string;
    username: string;
    created_at: Date;
  }>`
    SELECT u.id AS user_id, u.username, b.created_at
    FROM user_blocks b
    JOIN users u ON u.id = b.blocked_user_id
    WHERE b.blocker_user_id = ${params.blockerUserId}
    ORDER BY b.created_at DESC
  `;
  return result.rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    createdAt: r.created_at.getTime(),
  }));
}

