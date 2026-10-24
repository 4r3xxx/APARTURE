import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@photobooth/shared";

const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_URL ?? "http://localhost:4000";

// One connection is shared across the create, join, and waiting-room routes.
export const socket = io(signalingUrl, {
  autoConnect: false,
  reconnection: true,
  timeout: 10_000,
}) as Socket<ServerToClientEvents, ClientToServerEvents>;
