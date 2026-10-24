import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@photobooth/shared";

const isProduction = process.env.NODE_ENV === "production";
const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_URL ?? (isProduction ? undefined : "http://localhost:4000");
const signalingPath = process.env.NEXT_PUBLIC_SIGNALING_PATH ?? (isProduction ? "/server/socket.io" : "/socket.io");

// One connection is shared across the create, join, and waiting-room routes.
export const socket = io(signalingUrl, {
  path: signalingPath,
  autoConnect: false,
  transports: ["websocket"],
  reconnection: true,
  timeout: 10_000,
}) as Socket<ServerToClientEvents, ClientToServerEvents>;
