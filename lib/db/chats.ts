import { sql } from "@vercel/postgres";
import { areFriends } from "./friends";
import { getRoomRole } from "./rooms";

export type ChatThreadKind = "dm" | "project";

export type ChatThreadView = {
  id: string;
  kind: ChatThreadKind;
  roomId: string | null;
  title: string;
  createdAt: number;
};

export type ChatMessageView = {
  id: string;
  threadId: string;
  authorUserId: string;
  timestampMs: number;
  ciphertext: string;
  createdAt: number;
};

function dmThreadId(userIdA: string, userIdB: string): string {
  const [a, b] = [userIdA, userIdB].sort();
  return `dm_${a}_${b}`;
}

function projectThreadId(roomId: string): string {
  return `project_${roomId}`;
}

export async function getOrCreateDmThread(params: {
  userId: string;
  friendUserId: string;
}): Promise<string> {
  if (!(await areFriends({ userIdA: params.userId, userIdB: params.friendUserId }))) {
    throw new Error("Not friends");
  }

  const threadId = dmThreadId(params.userId, params.friendUserId);

  await sql`
    INSERT INTO chat_threads (id, kind, room_id)
    VALUES (${threadId}, 'dm', NULL)
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    INSERT INTO chat_thread_members (thread_id, user_id)
    VALUES (${threadId}, ${params.userId})
    ON CONFLICT (thread_id, user_id) DO NOTHING
  `;

  await sql`
    INSERT INTO chat_thread_members (thread_id, user_id)
    VALUES (${threadId}, ${params.friendUserId})
    ON CONFLICT (thread_id, user_id) DO NOTHING
  `;

  return threadId;
}

export async function getOrCreateProjectThread(params: {
  userId: string;
  roomId: string;
}): Promise<string> {
  const role = await getRoomRole({ roomId: params.roomId, userId: params.userId });
  if (!role) {
    throw new Error("Not a room member");
  }

  const threadId = projectThreadId(params.roomId);

  await sql`
    INSERT INTO chat_threads (id, kind, room_id)
    VALUES (${threadId}, 'project', ${params.roomId})
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    INSERT INTO chat_thread_members (thread_id, user_id)
    VALUES (${threadId}, ${params.userId})
    ON CONFLICT (thread_id, user_id) DO NOTHING
  `;

  return threadId;
}

export async function listChatThreads(userId: string): Promise<ChatThreadView[]> {
  const result = await sql<{
    id: string;
    kind: ChatThreadKind;
    room_id: string | null;
    created_at: Date;
    dm_other_username: string | null;
    room_name: string | null;
  }>`
    SELECT
      t.id,
      t.kind,
      t.room_id,
      t.created_at,
      CASE WHEN t.kind = 'dm' THEN dm_other.username ELSE NULL END AS dm_other_username,
      CASE WHEN t.kind = 'project' THEN r.name ELSE NULL END AS room_name
    FROM chat_thread_members m
    JOIN chat_threads t ON t.id = m.thread_id
    LEFT JOIN rooms r ON r.id = t.room_id
    LEFT JOIN LATERAL (
      SELECT u.username
      FROM chat_thread_members m2
      JOIN users u ON u.id = m2.user_id
      WHERE m2.thread_id = t.id AND m2.user_id <> ${userId}
      LIMIT 1
    ) dm_other ON t.kind = 'dm'
    WHERE m.user_id = ${userId}
    ORDER BY t.created_at DESC
  `;

  return result.rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    roomId: r.room_id,
    title: r.kind === "dm" ? r.dm_other_username ?? "DM" : r.room_name ?? "Project",
    createdAt: r.created_at.getTime(),
  }));
}

async function isThreadMember(params: {
  threadId: string;
  userId: string;
}): Promise<boolean> {
  const result = await sql<{ ok: number }>`
    SELECT 1 AS ok
    FROM chat_thread_members
    WHERE thread_id = ${params.threadId} AND user_id = ${params.userId}
    LIMIT 1
  `;
  return (result.rows[0]?.ok ?? 0) === 1;
}

export async function listChatMessages(params: {
  threadId: string;
  userId: string;
  since?: number;
  limit?: number;
}): Promise<ChatMessageView[]> {
  if (!(await isThreadMember({ threadId: params.threadId, userId: params.userId }))) {
    throw new Error("Not a thread member");
  }

  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);

  const since = params.since;
  const result = since
    ? await sql<{
        id: string;
        thread_id: string;
        author_user_id: string;
        timestamp_ms: number;
        ciphertext: string;
        created_at: Date;
      }>`
        SELECT id, thread_id, author_user_id, timestamp_ms, ciphertext, created_at
        FROM chat_messages
        WHERE thread_id = ${params.threadId} AND timestamp_ms > ${since}
        ORDER BY timestamp_ms ASC
        LIMIT ${limit}
      `
    : await sql<{
        id: string;
        thread_id: string;
        author_user_id: string;
        timestamp_ms: number;
        ciphertext: string;
        created_at: Date;
      }>`
        SELECT id, thread_id, author_user_id, timestamp_ms, ciphertext, created_at
        FROM chat_messages
        WHERE thread_id = ${params.threadId}
        ORDER BY timestamp_ms ASC
        LIMIT ${limit}
      `;

  return result.rows.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    authorUserId: r.author_user_id,
    timestampMs: Number(r.timestamp_ms),
    ciphertext: r.ciphertext,
    createdAt: r.created_at.getTime(),
  }));
}

export async function insertChatMessage(params: {
  messageId: string;
  threadId: string;
  authorUserId: string;
  timestampMs: number;
  ciphertext: string;
}): Promise<void> {
  if (!(await isThreadMember({ threadId: params.threadId, userId: params.authorUserId }))) {
    throw new Error("Not a thread member");
  }

  await sql`
    INSERT INTO chat_messages (id, thread_id, author_user_id, timestamp_ms, ciphertext)
    VALUES (${params.messageId}, ${params.threadId}, ${params.authorUserId}, ${params.timestampMs}, ${params.ciphertext})
    ON CONFLICT (id) DO UPDATE SET
      ciphertext = EXCLUDED.ciphertext,
      timestamp_ms = EXCLUDED.timestamp_ms
  `;
}

