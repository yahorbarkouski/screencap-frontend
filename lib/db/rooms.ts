import { sql } from "@vercel/postgres";

export type RoomKind = "project";
export type RoomVisibility = "private" | "public";
export type RoomRole = "owner" | "member";
export type RoomInviteStatus = "pending" | "accepted" | "rejected";

export type DbRoom = {
  id: string;
  kind: string;
  name: string;
  visibility: string;
  created_by: string;
  created_at: Date;
};

export type RoomView = {
  id: string;
  kind: RoomKind;
  name: string;
  visibility: RoomVisibility;
  role: RoomRole;
  createdBy: string;
  createdAt: number;
};

export type RoomInviteView = {
  id: string;
  roomId: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  status: RoomInviteStatus;
  createdAt: number;
  respondedAt: number | null;
};

export type IncomingRoomInviteSummary = {
  id: string;
  roomId: string;
  roomName: string;
  fromUserId: string;
  fromUsername: string;
  createdAt: number;
};

export async function createRoom(params: {
  roomId: string;
  createdByUserId: string;
  kind: RoomKind;
  name: string;
  visibility: RoomVisibility;
}): Promise<RoomView> {
  const roomResult = await sql<DbRoom>`
    INSERT INTO rooms (id, kind, name, visibility, created_by)
    VALUES (${params.roomId}, ${params.kind}, ${params.name}, ${params.visibility}, ${params.createdByUserId})
    RETURNING id, kind, name, visibility, created_by, created_at
  `;

  await sql`
    INSERT INTO room_members (room_id, user_id, role)
    VALUES (${params.roomId}, ${params.createdByUserId}, 'owner')
    ON CONFLICT (room_id, user_id) DO NOTHING
  `;

  const room = roomResult.rows[0];
  return {
    id: room.id,
    kind: room.kind as RoomKind,
    name: room.name,
    visibility: room.visibility as RoomVisibility,
    role: "owner",
    createdBy: room.created_by,
    createdAt: room.created_at.getTime(),
  };
}

export async function listRoomsForUser(userId: string): Promise<RoomView[]> {
  const result = await sql<{
    id: string;
    kind: string;
    name: string;
    visibility: string;
    created_by: string;
    created_at: Date;
    role: string;
  }>`
    SELECT r.id, r.kind, r.name, r.visibility, r.created_by, r.created_at, rm.role
    FROM room_members rm
    JOIN rooms r ON r.id = rm.room_id
    WHERE rm.user_id = ${userId}
    ORDER BY r.created_at DESC
  `;

  return result.rows.map((r) => ({
    id: r.id,
    kind: r.kind as RoomKind,
    name: r.name,
    visibility: r.visibility as RoomVisibility,
    role: r.role as RoomRole,
    createdBy: r.created_by,
    createdAt: r.created_at.getTime(),
  }));
}

export async function getRoomRole(params: {
  roomId: string;
  userId: string;
}): Promise<RoomRole | null> {
  const result = await sql<{ role: string }>`
    SELECT role
    FROM room_members
    WHERE room_id = ${params.roomId} AND user_id = ${params.userId}
  `;
  const role = result.rows[0]?.role;
  if (role === "owner" || role === "member") return role;
  return null;
}

export async function getRoomCreatedBy(params: {
  roomId: string;
}): Promise<string | null> {
  const result = await sql<{ created_by: string }>`
    SELECT created_by
    FROM rooms
    WHERE id = ${params.roomId}
  `;
  return result.rows[0]?.created_by ?? null;
}

export async function createRoomInvite(params: {
  inviteId: string;
  roomId: string;
  fromUserId: string;
  toUserId: string;
}): Promise<void> {
  await sql`
    INSERT INTO room_invites (id, room_id, from_user_id, to_user_id, status)
    VALUES (${params.inviteId}, ${params.roomId}, ${params.fromUserId}, ${params.toUserId}, 'pending')
    ON CONFLICT (room_id, to_user_id) DO UPDATE SET
      status = 'pending',
      created_at = NOW(),
      responded_at = NULL
  `;
}

export async function listIncomingRoomInvites(params: {
  roomId: string;
  userId: string;
}): Promise<RoomInviteView[]> {
  const result = await sql<{
    id: string;
    room_id: string;
    from_user_id: string;
    to_user_id: string;
    status: RoomInviteStatus;
    created_at: Date;
    responded_at: Date | null;
    from_username: string;
    to_username: string;
  }>`
    SELECT
      ri.id,
      ri.room_id,
      ri.from_user_id,
      ri.to_user_id,
      ri.status,
      ri.created_at,
      ri.responded_at,
      fu.username AS from_username,
      tu.username AS to_username
    FROM room_invites ri
    JOIN users fu ON fu.id = ri.from_user_id
    JOIN users tu ON tu.id = ri.to_user_id
    WHERE ri.room_id = ${params.roomId}
      AND ri.to_user_id = ${params.userId}
      AND ri.status = 'pending'
    ORDER BY ri.created_at DESC
  `;

  return result.rows.map((r) => ({
    id: r.id,
    roomId: r.room_id,
    fromUserId: r.from_user_id,
    fromUsername: r.from_username,
    toUserId: r.to_user_id,
    toUsername: r.to_username,
    status: r.status,
    createdAt: r.created_at.getTime(),
    respondedAt: r.responded_at ? r.responded_at.getTime() : null,
  }));
}

export async function listIncomingRoomInvitesForUser(params: {
  userId: string;
}): Promise<IncomingRoomInviteSummary[]> {
  const result = await sql<{
    id: string;
    room_id: string;
    room_name: string;
    from_user_id: string;
    from_username: string;
    created_at: Date;
  }>`
    SELECT
      ri.id,
      ri.room_id,
      r.name AS room_name,
      ri.from_user_id,
      fu.username AS from_username,
      ri.created_at
    FROM room_invites ri
    JOIN rooms r ON r.id = ri.room_id
    JOIN users fu ON fu.id = ri.from_user_id
    WHERE ri.to_user_id = ${params.userId}
      AND ri.status = 'pending'
    ORDER BY ri.created_at DESC
  `;

  return result.rows.map((r) => ({
    id: r.id,
    roomId: r.room_id,
    roomName: r.room_name,
    fromUserId: r.from_user_id,
    fromUsername: r.from_username,
    createdAt: r.created_at.getTime(),
  }));
}

export async function upsertRoomMemberKeyEnvelopes(params: {
  roomId: string;
  envelopes: Array<{ deviceId: string; envelopeJson: string }>;
}): Promise<void> {
  for (const env of params.envelopes) {
    await sql`
      INSERT INTO room_member_keys (room_id, device_id, envelope_json)
      VALUES (${params.roomId}, ${env.deviceId}, ${env.envelopeJson})
      ON CONFLICT (room_id, device_id) DO UPDATE SET
        envelope_json = EXCLUDED.envelope_json,
        created_at = NOW()
    `;
  }
}

export async function getRoomMemberKeyEnvelope(params: {
  roomId: string;
  deviceId: string;
}): Promise<string | null> {
  const result = await sql<{ envelope_json: string }>`
    SELECT envelope_json
    FROM room_member_keys
    WHERE room_id = ${params.roomId} AND device_id = ${params.deviceId}
  `;
  return result.rows[0]?.envelope_json ?? null;
}

export async function acceptRoomInviteIfPending(params: {
  roomId: string;
  userId: string;
}): Promise<void> {
  await sql`
    INSERT INTO room_members (room_id, user_id, role)
    VALUES (${params.roomId}, ${params.userId}, 'member')
    ON CONFLICT (room_id, user_id) DO NOTHING
  `;

  await sql`
    UPDATE room_invites
    SET status = 'accepted', responded_at = NOW()
    WHERE room_id = ${params.roomId}
      AND to_user_id = ${params.userId}
      AND status = 'pending'
  `;
}

export async function isUserInvitedToRoom(params: {
  roomId: string;
  userId: string;
}): Promise<boolean> {
  const result = await sql<{ ok: number }>`
    SELECT 1 AS ok
    FROM room_invites
    WHERE room_id = ${params.roomId}
      AND to_user_id = ${params.userId}
      AND status = 'pending'
    LIMIT 1
  `;
  return (result.rows[0]?.ok ?? 0) === 1;
}

export type RoomMemberView = {
  userId: string;
  username: string;
  role: RoomRole;
};

export async function listRoomMembers(params: {
  roomId: string;
}): Promise<RoomMemberView[]> {
  const result = await sql<{
    user_id: string;
    username: string;
    role: string;
  }>`
    SELECT rm.user_id, u.username, rm.role
    FROM room_members rm
    JOIN users u ON u.id = rm.user_id
    WHERE rm.room_id = ${params.roomId}
    ORDER BY rm.role ASC, u.username ASC
  `;

  return result.rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    role: r.role as RoomRole,
  }));
}
