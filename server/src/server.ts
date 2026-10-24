import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import type {
  BoothTheme,
  ClientToServerEvents,
  InterServerEvents,
  PhotoboothSocketData,
  RoomError,
  RoomErrorCode,
  RoomParticipantLeft,
  ServerToClientEvents,
} from "@photobooth/shared";
import { RoomManager, RoomManagerError, type RoomStore } from "./rooms/room-manager.js";
import { RedisRoomManager } from "./rooms/redis-room-manager.js";

const ROOM_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const ROOM_CLEANUP_INTERVAL_MS = 60 * 1000;
const BOOTH_THEMES: BoothTheme[] = ["halloween", "christmas", "summer", "valentines", "aesthetic", "modern", "love"];

type BoothSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, PhotoboothSocketData>;
type BoothServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, PhotoboothSocketData>;

const ERROR_MESSAGES: Record<RoomErrorCode, string> = {
  INVALID_ROOM_ID: "Enter a valid 32-character room code.",
  ROOM_NOT_FOUND: "This booth has ended or the invite has expired.",
  ROOM_FULL: "This booth already has two people in it.",
  ALREADY_IN_ROOM: "Leave your current room before joining another one.",
  NOT_IN_ROOM: "Join a booth before changing its room state.",
  INVALID_PAYLOAD: "That request is missing information. Please try again.",
  ROOM_EXPIRED: "This booth expired after an hour without activity.",
  SERVER_UNAVAILABLE: "We couldn’t reach the booth server. Check your connection and try again.",
};

function toRoomError(error: unknown, roomId?: string): RoomError {
  if (error instanceof RoomManagerError) {
    return { code: error.code, message: error.message, ...(error.roomId ? { roomId: error.roomId } : {}) };
  }
  return { code: "SERVER_UNAVAILABLE", message: ERROR_MESSAGES.SERVER_UNAVAILABLE, ...(roomId ? { roomId } : {}) };
}

function emitParticipantLeft(io: BoothServer, event: RoomParticipantLeft) {
  io.to(event.room.id).emit("room:user-left", event);
  io.to(event.room.id).emit("room:state", event.room);
}

export function createPhotoboothServer(options: {
  clientOrigin?: string;
  roomIdleTimeoutMs?: number;
  cleanupIntervalMs?: number;
  roomManager?: RoomStore;
} = {}) {
  const clientOrigin = options.clientOrigin ?? process.env.CLIENT_ORIGIN ?? (process.env.VERCEL ? false : "http://localhost:3000");
  const roomIdleTimeoutMs = options.roomIdleTimeoutMs ?? ROOM_IDLE_TIMEOUT_MS;
  const redisUrl = process.env.REDIS_URL;
  if (process.env.VERCEL && !options.roomManager && !redisUrl) {
    throw new Error("REDIS_URL is required on Vercel so booth rooms work across function instances.");
  }
  const redisPublisher = redisUrl ? new Redis(redisUrl) : undefined;
  const redisSubscriber = redisUrl ? new Redis(redisUrl) : undefined;
  const roomManager: RoomStore = options.roomManager ?? (redisPublisher
    ? new RedisRoomManager(redisPublisher, roomIdleTimeoutMs)
    : new RoomManager());
  const app = express();
  app.use(cors({ origin: clientOrigin }));
  app.get(["/healthz", "/server/healthz"], (_request, response) => response.json({ status: "ok" }));

  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, PhotoboothSocketData>(httpServer, {
    path: process.env.SOCKET_IO_PATH ?? (process.env.VERCEL ? "/server/socket.io" : "/socket.io"),
    cors: { origin: clientOrigin, methods: ["GET", "POST"] },
  });
  if (redisPublisher && redisSubscriber) {
    io.adapter(createAdapter(redisPublisher, redisSubscriber));
  }

  io.on("connection", (socket: BoothSocket) => {
    socket.on("room:create", async (request) => {
      try {
        const theme = request?.theme ?? "love";
        if (!BOOTH_THEMES.includes(theme)) {
          socket.emit("room:error", toRoomError(new RoomManagerError("INVALID_PAYLOAD", ERROR_MESSAGES.INVALID_PAYLOAD)));
          return;
        }
        const membership = await roomManager.create(socket.id, theme);
        socket.data.roomId = membership.room.id;
        socket.data.participantId = membership.selfParticipantId;
        await socket.join(membership.room.id);
        socket.emit("room:created", membership);
      } catch (error) {
        socket.emit("room:error", toRoomError(error));
      }
    });

    socket.on("room:join", async (request) => {
      if (!request || typeof request.roomId !== "string") {
        socket.emit("room:error", toRoomError(new RoomManagerError("INVALID_PAYLOAD", ERROR_MESSAGES.INVALID_PAYLOAD)));
        return;
      }

      try {
        const result = await roomManager.join(socket.id, request.roomId);
        socket.data.roomId = result.room.id;
        socket.data.participantId = result.selfParticipantId;
        await socket.join(result.room.id);
        socket.emit("room:joined", { room: result.room, selfParticipantId: result.selfParticipantId });

        if (result.newParticipant) {
          socket.to(result.room.id).emit("room:user-joined", {
            participant: result.newParticipant,
            room: result.room,
          });
          io.to(result.room.id).emit("room:state", result.room);
        }
      } catch (error) {
        socket.emit("room:error", toRoomError(error, request.roomId));
      }
    });

    socket.on("room:ready", async (request) => {
      if (!request || typeof request.ready !== "boolean") {
        socket.emit("room:error", toRoomError(new RoomManagerError("INVALID_PAYLOAD", ERROR_MESSAGES.INVALID_PAYLOAD)));
        return;
      }

      try {
        const room = await roomManager.setReady(socket.id, request.ready);
        io.to(room.id).emit("room:state", room);
      } catch (error) {
        socket.emit("room:error", toRoomError(error));
      }
    });

    socket.on("room:leave", async () => {
      try {
        const result = await roomManager.leave(socket.id);
        if (!result) {
          socket.emit("room:error", toRoomError(new RoomManagerError("NOT_IN_ROOM", ERROR_MESSAGES.NOT_IN_ROOM)));
          return;
        }

        socket.data.roomId = undefined;
        socket.data.participantId = undefined;
        socket.leave(result.roomId);
        socket.emit("room:left", { roomId: result.roomId });

        if (result.room) {
          emitParticipantLeft(io, {
            participantId: result.participant.id,
            reason: "left",
            room: result.room,
          });
        }
      } catch (error) {
        socket.emit("room:error", toRoomError(error));
      }
    });

    socket.on("disconnect", async () => {
      try {
        const result = await roomManager.leave(socket.id);
        socket.data.roomId = undefined;
        socket.data.participantId = undefined;

        if (result?.room) {
          emitParticipantLeft(io, {
            participantId: result.participant.id,
            reason: "disconnected",
            room: result.room,
          });
        }
      } catch (error) {
        console.error("Unable to remove disconnected booth participant", error);
      }
    });
  });

  const cleanupTimer = setInterval(async () => {
    try {
      const expiredRooms = await roomManager.expireInactive(Date.now(), roomIdleTimeoutMs);
      for (const expired of expiredRooms) {
        io.to(expired.roomId).emit("room:error", {
          code: "ROOM_EXPIRED",
          message: ERROR_MESSAGES.ROOM_EXPIRED,
          roomId: expired.roomId,
        });
        for (const socketId of expired.socketIds) {
          const socket = io.sockets.sockets.get(socketId);
          if (!socket) continue;
          socket.data.roomId = undefined;
          socket.data.participantId = undefined;
          socket.leave(expired.roomId);
        }
      }
    } catch (error) {
      console.error("Unable to expire inactive booth rooms", error);
    }
  }, options.cleanupIntervalMs ?? ROOM_CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  const activityTimer = setInterval(() => {
    if (!roomManager.touch) return;
    for (const socket of io.sockets.sockets.values()) {
      void Promise.resolve(roomManager.touch(socket.id)).catch((error: unknown) => {
        console.error("Unable to refresh active booth room", error);
      });
    }
  }, 5 * 60 * 1000);
  activityTimer.unref();

  return {
    app,
    httpServer,
    io,
    roomManager,
    close: () => new Promise<void>((resolve) => {
      clearInterval(cleanupTimer);
      clearInterval(activityTimer);
      io.close(async () => {
        await Promise.all([redisPublisher?.quit(), redisSubscriber?.quit()]);
        resolve();
      });
    }),
  };
}
