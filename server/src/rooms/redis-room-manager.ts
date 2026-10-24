import { randomBytes, randomUUID } from "node:crypto";
import type { Redis as RedisClient } from "ioredis";
import type {
  BoothTheme,
  RoomMembership,
  RoomParticipant,
  RoomRole,
  RoomSnapshot,
} from "@photobooth/shared";
import {
  RoomManagerError,
  type ExpiredRoom,
  type JoinResult,
  type LeaveResult,
  type RoomStore,
} from "./room-manager.js";

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
  participants: StoredParticipant[];
}

const CREATE_ROOM = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return cjson.encode({ error = 'ALREADY_IN_ROOM' })
end
if redis.call('EXISTS', KEYS[2]) == 1 then
  return cjson.encode({ error = 'ROOM_COLLISION' })
end
redis.call('SET', KEYS[2], ARGV[4], 'EX', ARGV[3])
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
return cjson.encode({ room = cjson.decode(ARGV[4]) })
`;

const JOIN_ROOM = `
local roomId = ARGV[1]
local socketId = ARGV[2]
local currentRoomId = redis.call('GET', KEYS[2])
if currentRoomId and currentRoomId ~= roomId then
  return cjson.encode({ error = 'ALREADY_IN_ROOM', roomId = currentRoomId })
end
local rawRoom = redis.call('GET', KEYS[1])
if not rawRoom then
  return cjson.encode({ error = 'ROOM_NOT_FOUND', roomId = roomId })
end
local room = cjson.decode(rawRoom)
for _, entry in ipairs(room.participants) do
  if entry.socketId == socketId then
    room.updatedAt = tonumber(ARGV[4])
    redis.call('SET', KEYS[1], cjson.encode(room), 'EX', ARGV[5])
    redis.call('SET', KEYS[2], roomId, 'EX', ARGV[5])
    return cjson.encode({ room = room, participant = entry.publicParticipant, isNew = false })
  end
end
if #room.participants >= 2 then
  return cjson.encode({ error = 'ROOM_FULL', roomId = roomId })
end
local participant = cjson.decode(ARGV[3])
local role = 'host'
for _, entry in ipairs(room.participants) do
  if entry.publicParticipant.role == 'host' then role = 'guest' end
end
participant.role = role
table.insert(room.participants, { publicParticipant = participant, socketId = socketId })
room.updatedAt = tonumber(ARGV[4])
redis.call('SET', KEYS[1], cjson.encode(room), 'EX', ARGV[5])
redis.call('SET', KEYS[2], roomId, 'EX', ARGV[5])
return cjson.encode({ room = room, participant = participant, isNew = true })
`;

const SET_READY = `
local roomId = redis.call('GET', KEYS[1])
if not roomId then return cjson.encode({ error = 'NOT_IN_ROOM' }) end
local roomKey = ARGV[4] .. roomId
local rawRoom = redis.call('GET', roomKey)
if not rawRoom then
  redis.call('DEL', KEYS[1])
  return cjson.encode({ error = 'NOT_IN_ROOM' })
end
local room = cjson.decode(rawRoom)
for _, entry in ipairs(room.participants) do
  if entry.socketId == ARGV[1] then
    entry.publicParticipant.ready = ARGV[2] == 'true'
    room.updatedAt = tonumber(ARGV[3])
    redis.call('SET', roomKey, cjson.encode(room), 'EX', ARGV[5])
    redis.call('EXPIRE', KEYS[1], ARGV[5])
    return cjson.encode({ room = room })
  end
end
redis.call('DEL', KEYS[1])
return cjson.encode({ error = 'NOT_IN_ROOM' })
`;

const LEAVE_ROOM = `
local roomId = redis.call('GET', KEYS[2])
if not roomId then return cjson.encode({}) end
local rawRoom = redis.call('GET', KEYS[1])
redis.call('DEL', KEYS[2])
if not rawRoom then return cjson.encode({}) end
local room = cjson.decode(rawRoom)
local participant = nil
for index, entry in ipairs(room.participants) do
  if entry.socketId == ARGV[1] then
    participant = entry.publicParticipant
    table.remove(room.participants, index)
    break
  end
end
if not participant then return cjson.encode({}) end
if #room.participants == 0 then
  redis.call('DEL', KEYS[1])
  return cjson.encode({ roomId = roomId, participant = participant })
end
room.updatedAt = tonumber(ARGV[2])
redis.call('SET', KEYS[1], cjson.encode(room), 'EX', ARGV[3])
return cjson.encode({ roomId = roomId, participant = participant, room = room })
`;

const TOUCH_SOCKET = `
local roomId = redis.call('GET', KEYS[1])
if not roomId then return 0 end
if redis.call('EXISTS', ARGV[1] .. roomId) == 0 then
  redis.call('DEL', KEYS[1])
  return 0
end
redis.call('EXPIRE', KEYS[1], ARGV[2])
redis.call('EXPIRE', ARGV[1] .. roomId, ARGV[2])
return 1
`;

interface ScriptResult {
  error?: string;
  roomId?: string;
  room?: StoredRoom;
  participant?: RoomParticipant;
  isNew?: boolean;
}

export class RedisRoomManager implements RoomStore {
  private readonly keyPrefix = "photobooth:";
  private readonly ttlSeconds: number;

  constructor(private readonly redis: RedisClient, idleTimeoutMs: number) {
    this.ttlSeconds = Math.ceil(idleTimeoutMs / 1000);
  }

  async create(socketId: string, theme: BoothTheme = "aesthetic"): Promise<RoomMembership> {
    const now = Date.now();
    const participant = this.createParticipant("host", now);
    let roomId = randomBytes(16).toString("hex");
    const room: StoredRoom = {
      id: roomId,
      theme,
      createdAt: now,
      updatedAt: now,
      participants: [{ publicParticipant: participant, socketId }],
    };

    let result = await this.eval(CREATE_ROOM, [this.socketKey(socketId), this.roomKey(roomId)], [
      roomId,
      socketId,
      this.ttlSeconds,
      JSON.stringify(room),
    ]);
    while (result.error === "ROOM_COLLISION") {
      roomId = randomBytes(16).toString("hex");
      room.id = roomId;
      result = await this.eval(CREATE_ROOM, [this.socketKey(socketId), this.roomKey(roomId)], [
        roomId,
        socketId,
        this.ttlSeconds,
        JSON.stringify(room),
      ]);
    }
    this.throwScriptError(result);
    return { room: this.toSnapshot(result.room!), selfParticipantId: participant.id };
  }

  async join(socketId: string, inputRoomId: string): Promise<JoinResult> {
    const roomId = inputRoomId.trim().toLowerCase();
    if (!ROOM_ID_PATTERN.test(roomId)) {
      throw new RoomManagerError("INVALID_ROOM_ID", "Enter a valid 32-character room code.");
    }

    const now = Date.now();
    const participant = this.createParticipant("guest", now);
    const result = await this.eval(JOIN_ROOM, [this.roomKey(roomId), this.socketKey(socketId)], [
      roomId,
      socketId,
      JSON.stringify(participant),
      now,
      this.ttlSeconds,
    ]);
    this.throwScriptError(result);
    const joinedParticipant = result.participant!;
    return {
      room: this.toSnapshot(result.room!),
      selfParticipantId: joinedParticipant.id,
      newParticipant: result.isNew ? joinedParticipant : null,
    };
  }

  async setReady(socketId: string, ready: boolean): Promise<RoomSnapshot> {
    const now = Date.now();
    const result = await this.eval(
      SET_READY,
      [this.socketKey(socketId)],
      [socketId, ready, now, this.keyPrefix + "room:", this.ttlSeconds],
    );
    this.throwScriptError(result);
    return this.toSnapshot(result.room!);
  }

  async leave(socketId: string): Promise<LeaveResult | null> {
    const roomId = await this.redis.get(this.socketKey(socketId));
    if (!roomId) return null;
    const result = await this.eval(LEAVE_ROOM, [this.roomKey(roomId), this.socketKey(socketId)], [
      socketId,
      Date.now(),
      this.ttlSeconds,
    ]);
    if (!result.roomId || !result.participant) return null;
    return {
      roomId: result.roomId,
      participant: result.participant,
      room: result.room ? this.toSnapshot(result.room) : null,
    };
  }

  async touch(socketId: string): Promise<void> {
    await this.eval(TOUCH_SOCKET, [this.socketKey(socketId)], [this.keyPrefix + "room:", this.ttlSeconds]);
  }

  expireInactive(_now: number, _idleTimeoutMs: number): ExpiredRoom[] {
    // Redis expirations are refreshed while local sockets are active and remove
    // inactive rooms without requiring a process-local scan.
    return [];
  }

  private async eval(script: string, keys: string[], args: Array<string | number | boolean>): Promise<ScriptResult> {
    const result = await this.redis.eval(script, keys.length, ...keys, ...args.map(String));
    return JSON.parse(String(result)) as ScriptResult;
  }

  private throwScriptError(result: ScriptResult): void {
    if (!result.error) return;
    if (result.error === "ROOM_COLLISION") return;
    const messages: Record<string, string> = {
      ALREADY_IN_ROOM: "Leave your current room before joining another one.",
      ROOM_NOT_FOUND: "This booth has ended or the invite has expired.",
      ROOM_FULL: "This booth already has two people in it.",
      NOT_IN_ROOM: "Join a booth before changing its room state.",
    };
    throw new RoomManagerError(result.error as ConstructorParameters<typeof RoomManagerError>[0], messages[result.error] ?? "That request could not be completed.", result.roomId);
  }

  private socketKey(socketId: string): string {
    return `${this.keyPrefix}socket:${socketId}`;
  }

  private roomKey(roomId: string): string {
    return `${this.keyPrefix}room:${roomId}`;
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
      participants: room.participants
        .map(({ publicParticipant }) => ({ ...publicParticipant }))
        .sort((first, second) => first.connectedAt - second.connectedAt),
    };
  }
}
