import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";
import type { RoomError, RoomMembership, RoomParticipantLeft, RoomSnapshot } from "@photobooth/shared";
import { createPhotoboothServer } from "./server.js";

type TestClient = ClientSocket;

function nextEvent<EventPayload>(socket: TestClient, eventName: string): Promise<EventPayload> {
  return new Promise((resolve) => {
    socket.once(eventName, (payload: EventPayload) => resolve(payload));
  });
}

async function openClient(url: string): Promise<TestClient> {
  const socket = connect(url, {
    transports: ["websocket"],
    reconnection: false,
  }) as TestClient;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Socket.IO test client did not connect in time.")), 5_000);
    socket.once("connect", () => { clearTimeout(timer); resolve(); });
    socket.once("connect_error", (error) => { clearTimeout(timer); reject(error); });
  });
  return socket;
}

describe("Socket.IO room system", () => {
  const service = createPhotoboothServer({ cleanupIntervalMs: 60_000 });
  const clients: TestClient[] = [];
  let serverUrl = "";

  before(async () => {
    await new Promise<void>((resolve) => service.httpServer.listen(0, "127.0.0.1", resolve));
    const address = service.httpServer.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    for (const client of clients) client.disconnect();
    await service.close();
  });

  it("creates and joins a room, enforces capacity, broadcasts readiness, and cleans up disconnects", async () => {
    const host = await openClient(serverUrl);
    const guest = await openClient(serverUrl);
    const third = await openClient(serverUrl);
    clients.push(host, guest, third);

    const createdEvent = nextEvent<RoomMembership>(host, "room:created");
    host.emit("room:create");
    const created = await createdEvent;

    const joinedEvent = nextEvent<RoomMembership>(guest, "room:joined");
    const hostJoinNotice = nextEvent(host, "room:user-joined");
    guest.emit("room:join", { roomId: created.room.id });
    const joined = await joinedEvent;
    await hostJoinNotice;
    assert.equal(joined.room.participants.length, 2);

    const fullErrorEvent = nextEvent<RoomError>(third, "room:error");
    third.emit("room:join", { roomId: created.room.id });
    const fullError = await fullErrorEvent;
    assert.equal(fullError.code, "ROOM_FULL");

    const hostReadyState = nextEvent<RoomSnapshot>(host, "room:state");
    const guestReadyState = nextEvent<RoomSnapshot>(guest, "room:state");
    host.emit("room:ready", { ready: true });
    const [hostRoom, guestRoom] = await Promise.all([hostReadyState, guestReadyState]);
    assert.deepEqual(hostRoom, guestRoom);
    assert.equal(hostRoom.participants.find((participant) => participant.id === created.selfParticipantId)?.ready, true);

    const hostLeftEvent = nextEvent<RoomParticipantLeft>(guest, "room:user-left");
    host.disconnect();
    const hostLeft = await hostLeftEvent;
    assert.equal(hostLeft.reason, "disconnected");
    assert.equal(hostLeft.room.participants.length, 1);

    const leaveAck = nextEvent<{ roomId: string }>(guest, "room:left");
    guest.emit("room:leave");
    assert.equal((await leaveAck).roomId, created.room.id);

    const missingErrorEvent = nextEvent<RoomError>(third, "room:error");
    third.emit("room:join", { roomId: created.room.id });
    assert.equal((await missingErrorEvent).code, "ROOM_NOT_FOUND");
  });
});
