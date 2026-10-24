import { randomBytes, randomUUID } from "node:crypto";
import type {
  BoothTheme,
  RoomErrorCode,
  RoomMembership,
  RoomParticipant,
  RoomRole,
  RoomSnapshot,
} from "@photobooth/shared";

const ROOM_ID_PATTERN = /^[a-f0-9]{32}$/i;

interface StoredParticipant {
  publicParticipant: RoomParticipant;
  socketId: string;
}

interface StoredRoom {
  id: string;
  theme: BoothTheme;
  createdAt: number;
  updatedAt: number;
  participants: Map<string, StoredParticipant>;
}

export interface JoinResult extends RoomMembership {
  newParticipant: RoomParticipant | null;
}

export interface LeaveResult {
  roomId: string;
  participant: RoomParticipant;
  room: RoomSnapshot | null;
}

export interface ExpiredRoom {
  roomId: string;
  socketIds: string[];
}

export class RoomManagerError extends Error {
  constructor(
    public readonly code: RoomErrorCode,
    message: string,
    public readonly roomId?: string,
  ) {
    super(message);
    this.name = "RoomManagerError";
  }
}

export class RoomManager {
  private readonly rooms = new Map<string, StoredRoom>();
  private readonly roomBySocket = new Map<string, string>();

  create(socketId: string, theme: BoothTheme = "love"): RoomMembership {
    this.assertSocketIsFree(socketId);

    let roomId = randomBytes(16).toString("hex");
    while (this.rooms.has(roomId)) roomId = randomBytes(16).toString("hex");

    const now = Date.now();
    const participant = this.createParticipant("host", now);
    const room: StoredRoom = {
      id: roomId,
      theme,
      createdAt: now,
      updatedAt: now,
      participants: new Map([[participant.id, { publicParticipant: participant, socketId }]]),
    };

    this.rooms.set(roomId, room);
    this.roomBySocket.set(socketId, roomId);
    return { room: this.toSnapshot(room), selfParticipantId: participant.id };
  }

  join(socketId: string, inputRoomId: string): JoinResult {
    const roomId = inputRoomId.trim().toLowerCase();
    if (!ROOM_ID_PATTERN.test(roomId)) {
      throw new RoomManagerError("INVALID_ROOM_ID", "Enter a valid 32-character room code.");
    }

    const currentRoomId = this.roomBySocket.get(socketId);
    if (currentRoomId && currentRoomId !== roomId) {
      throw new RoomManagerError(
        "ALREADY_IN_ROOM",
        "Leave your current room before joining another one.",
        currentRoomId,
      );
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new RoomManagerError("ROOM_NOT_FOUND", "This booth has ended or the invite has expired.", roomId);
    }

    const currentParticipant = [...room.participants.values()].find((participant) => participant.socketId === socketId);
    if (currentParticipant) {
      room.updatedAt = Date.now();
      return {
        room: this.toSnapshot(room),
        selfParticipantId: currentParticipant.publicParticipant.id,
        newParticipant: null,
      };
    }

    if (room.participants.size >= 2) {
      throw new RoomManagerError("ROOM_FULL", "This booth already has two people in it.", roomId);
    }

    const role: RoomRole = [...room.participants.values()].some(
      (participant) => participant.publicParticipant.role === "host",
    ) ? "guest" : "host";
    const participant = this.createParticipant(role, Date.now());
    room.participants.set(participant.id, { publicParticipant: participant, socketId });
    room.updatedAt = Date.now();
    this.roomBySocket.set(socketId, roomId);

    return {
      room: this.toSnapshot(room),
      selfParticipantId: participant.id,
      newParticipant: participant,
    };
  }

  setReady(socketId: string, ready: boolean): RoomSnapshot {
    const roomId = this.roomBySocket.get(socketId);
    const room = roomId ? this.rooms.get(roomId) : undefined;
    const participant = room && [...room.participants.values()].find((entry) => entry.socketId === socketId);

    if (!room || !participant) {
      throw new RoomManagerError("NOT_IN_ROOM", "Join a booth before changing your ready status.");
    }

    participant.publicParticipant.ready = ready;
    room.updatedAt = Date.now();
    return this.toSnapshot(room);
  }

  leave(socketId: string): LeaveResult | null {
    const roomId = this.roomBySocket.get(socketId);
    const room = roomId ? this.rooms.get(roomId) : undefined;
    const entry = room && [...room.participants.entries()].find(([, participant]) => participant.socketId === socketId);

    if (!room || !roomId || !entry) {
      this.roomBySocket.delete(socketId);
      return null;
    }

    const [participantId, storedParticipant] = entry;
    room.participants.delete(participantId);
    this.roomBySocket.delete(socketId);

    if (room.participants.size === 0) {
      this.rooms.delete(roomId);
      return { roomId, participant: storedParticipant.publicParticipant, room: null };
    }

    room.updatedAt = Date.now();
    return {
      roomId,
      participant: storedParticipant.publicParticipant,
      room: this.toSnapshot(room),
    };
  }

  expireInactive(now: number, idleTimeoutMs: number): ExpiredRoom[] {
    const expired: ExpiredRoom[] = [];
    for (const [roomId, room] of this.rooms) {
      if (now - room.updatedAt < idleTimeoutMs) continue;

      const socketIds = [...room.participants.values()].map((participant) => participant.socketId);
      for (const socketId of socketIds) this.roomBySocket.delete(socketId);
      this.rooms.delete(roomId);
      expired.push({ roomId, socketIds });
    }
    return expired;
  }

  private assertSocketIsFree(socketId: string): void {
    if (this.roomBySocket.has(socketId)) {
      throw new RoomManagerError("ALREADY_IN_ROOM", "Leave your current room before creating another one.");
    }
  }

  private createParticipant(role: RoomRole, connectedAt: number): RoomParticipant {
    return { id: randomUUID(), role, ready: false, connectedAt };
  }

  private toSnapshot(room: StoredRoom): RoomSnapshot {
    return {
      id: room.id,
      theme: room.theme,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      participants: [...room.participants.values()]
        .map(({ publicParticipant }) => ({ ...publicParticipant }))
        .sort((first, second) => first.connectedAt - second.connectedAt),
    };
  }
}
