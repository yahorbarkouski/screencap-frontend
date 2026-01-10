import { sql } from "@vercel/postgres";

export type DbRoomEvent = {
  id: string;
  room_id: string;
  author_user_id: string;
  timestamp_ms: number;
  payload_ciphertext: string;
  image_ref: string | null;
  created_at: Date;
};

export type RoomEventView = {
  id: string;
  roomId: string;
  authorUserId: string;
  timestampMs: number;
  payloadCiphertext: string;
  imageRef: string | null;
  createdAt: number;
};

export async function upsertRoomEvent(params: {
  id: string;
  roomId: string;
  authorUserId: string;
  timestampMs: number;
  payloadCiphertext: string;
}): Promise<DbRoomEvent> {
  const result = await sql<DbRoomEvent>`
    INSERT INTO room_events (id, room_id, author_user_id, timestamp_ms, payload_ciphertext)
    VALUES (${params.id}, ${params.roomId}, ${params.authorUserId}, ${params.timestampMs}, ${params.payloadCiphertext})
    ON CONFLICT (id) DO UPDATE SET
      payload_ciphertext = EXCLUDED.payload_ciphertext,
      timestamp_ms = EXCLUDED.timestamp_ms
    RETURNING id, room_id, author_user_id, timestamp_ms, payload_ciphertext, image_ref, created_at
  `;
  return result.rows[0];
}

export async function setRoomEventImageRef(params: {
  roomId: string;
  eventId: string;
  imageRef: string;
}): Promise<void> {
  await sql`
    UPDATE room_events
    SET image_ref = ${params.imageRef}
    WHERE id = ${params.eventId} AND room_id = ${params.roomId}
  `;
}

export async function listRoomEvents(params: {
  roomId: string;
  since?: number;
  before?: number;
  limit?: number;
}): Promise<RoomEventView[]> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

  if (params.since !== undefined) {
    const result = await sql<DbRoomEvent>`
      SELECT id, room_id, author_user_id, timestamp_ms, payload_ciphertext, image_ref, created_at
      FROM room_events
      WHERE room_id = ${params.roomId} AND timestamp_ms > ${params.since}
      ORDER BY timestamp_ms DESC
      LIMIT ${limit}
    `;
    return result.rows.map(mapRoomEvent);
  }

  if (params.before !== undefined) {
    const result = await sql<DbRoomEvent>`
      SELECT id, room_id, author_user_id, timestamp_ms, payload_ciphertext, image_ref, created_at
      FROM room_events
      WHERE room_id = ${params.roomId} AND timestamp_ms < ${params.before}
      ORDER BY timestamp_ms DESC
      LIMIT ${limit}
    `;
    return result.rows.map(mapRoomEvent);
  }

  const result = await sql<DbRoomEvent>`
    SELECT id, room_id, author_user_id, timestamp_ms, payload_ciphertext, image_ref, created_at
    FROM room_events
    WHERE room_id = ${params.roomId}
    ORDER BY timestamp_ms DESC
    LIMIT ${limit}
  `;
  return result.rows.map(mapRoomEvent);
}

function mapRoomEvent(row: DbRoomEvent): RoomEventView {
  return {
    id: row.id,
    roomId: row.room_id,
    authorUserId: row.author_user_id,
    timestampMs: Number(row.timestamp_ms),
    payloadCiphertext: row.payload_ciphertext,
    imageRef: row.image_ref,
    createdAt: row.created_at.getTime(),
  };
}

export async function deleteRoomEvent(params: {
  eventId: string;
  roomId: string;
  authorUserId: string;
}): Promise<DbRoomEvent | null> {
  const result = await sql<DbRoomEvent>`
    DELETE FROM room_events
    WHERE id = ${params.eventId}
      AND room_id = ${params.roomId}
      AND author_user_id = ${params.authorUserId}
    RETURNING id, room_id, author_user_id, timestamp_ms, payload_ciphertext, image_ref, created_at
  `;
  return result.rows[0] ?? null;
}

