import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RoomManager, RoomManagerError } from "./room-manager.js";

describe("RoomManager", () => {
  it("creates a private room, admits two participants, and rejects a third", () => {
    const rooms = new RoomManager();
    const host = rooms.create("socket-host");
    const guest = rooms.join("socket-guest", host.room.id);

    assert.match(host.room.id, /^[a-f0-9]{32}$/);
    assert.equal(host.room.participants.length, 1);
    assert.equal(guest.room.participants.length, 2);
    assert.equal(guest.newParticipant?.role, "guest");
    assert.throws(
      () => rooms.join("socket-third", host.room.id),
      (error: unknown) => error instanceof RoomManagerError && error.code === "ROOM_FULL",
    );
  });

  it("keeps same-socket joins idempotent and stores ready state on the server", () => {
    const rooms = new RoomManager();
    const membership = rooms.create("socket-host");
    const duplicateJoin = rooms.join("socket-host", membership.room.id);

    assert.equal(duplicateJoin.selfParticipantId, membership.selfParticipantId);
    assert.equal(duplicateJoin.newParticipant, null);
    const updated = rooms.setReady("socket-host", true);
    assert.equal(updated.participants[0]?.ready, true);
  });

  it("deletes rooms when everyone leaves and expires idle rooms", () => {
    const rooms = new RoomManager();
    const first = rooms.create("socket-first");
    rooms.leave("socket-first");
    assert.throws(() => rooms.join("socket-next", first.room.id), (error: unknown) =>
      error instanceof RoomManagerError && error.code === "ROOM_NOT_FOUND",
    );

    const idle = rooms.create("socket-idle");
    const expired = rooms.expireInactive(Date.now() + 100_000, 60_000);
    assert.deepEqual(expired, [{ roomId: idle.room.id, socketIds: ["socket-idle"] }]);
    assert.equal(rooms.leave("socket-idle"), null);
  });
});
