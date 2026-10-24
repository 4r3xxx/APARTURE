# Phase 6 — Socket.IO room events

The browser connects to the signaling server at `NEXT_PUBLIC_SIGNALING_URL`. Socket.IO carries room state and signaling messages; it does not carry camera video.

## Event contract

| Direction | Event | Payload | Result |
| --- | --- | --- | --- |
| Client → server | `room:create` | `{ theme }` | Creates a room with a cryptographically random 128-bit ID and adds the caller as host. The selected booth theme is included in every room snapshot. |
| Server → client | `room:created` | `RoomMembership` | Returns the room snapshot and the caller’s participant ID. |
| Client → server | `room:join` | `{ roomId }` | Validates the ID and adds the caller if a seat is available. Repeating the same join from the same socket is idempotent. |
| Server → client | `room:joined` | `RoomMembership` | Returns the current snapshot and the caller’s participant ID. |
| Server → room | `room:user-joined` | `{ participant, room }` | Notifies the existing participant when the other person arrives. |
| Client → server | `room:ready` | `{ ready }` | Changes the sender’s ready flag. The server ignores requests from sockets that are not room members. |
| Server → room | `room:state` | `RoomSnapshot` | Publishes the authoritative participant and ready state after a change. |
| Client → server | `room:leave` | none | Removes the caller and releases their seat. |
| Server → leaving client | `room:left` | `{ roomId }` | Confirms the caller left. |
| Server → remaining participant | `room:user-left` | `{ participantId, reason, room }` | Announces an explicit leave or unexpected disconnect. |
| Server → client | `room:error` | `{ code, message, roomId? }` | Reports an invalid, full, missing, expired, or unauthorized room operation. |

## Room lifecycle and privacy

- Room state lives in the signaling server’s memory. No account, database, or photo upload is part of this phase.
- Supported room themes are `halloween`, `christmas`, `summer`, `valentines`, `aesthetic`, and `modern`. Clients that create a room without a theme receive `aesthetic` by default.
- Room IDs contain 128 random bits and are validated on the server. A room admits at most two sockets, and a socket can be in only one room at a time.
- An empty room is deleted immediately. A room with no activity for one hour expires and connected participants receive `room:error` with `ROOM_EXPIRED`.
- A disconnected participant is removed; if another person remains, they receive `room:user-left` with reason `disconnected` and can share the same link again.
- `CLIENT_ORIGIN` continues to restrict browser access to the configured frontend origin.

Room state is process-local for the MVP, so a multi-instance production deployment will need sticky routing or a shared Socket.IO adapter before horizontal scaling.
