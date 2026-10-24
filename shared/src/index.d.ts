export type RoomRole = "host" | "guest";
export type BoothTheme = "halloween" | "christmas" | "summer" | "valentines" | "aesthetic" | "modern" | "love";
export type RoomErrorCode = "INVALID_ROOM_ID" | "ROOM_NOT_FOUND" | "ROOM_FULL" | "ALREADY_IN_ROOM" | "NOT_IN_ROOM" | "INVALID_PAYLOAD" | "ROOM_EXPIRED" | "SERVER_UNAVAILABLE";

export interface RoomParticipant {
  id: string;
  role: RoomRole;
  ready: boolean;
  connectedAt: number;
}

export interface RoomSnapshot {
  id: string;
  theme: BoothTheme;
  createdAt: number;
  updatedAt: number;
  participants: RoomParticipant[];
}

export interface RoomMembership {
  room: RoomSnapshot;
  selfParticipantId: string;
}

export interface RoomJoinRequest { roomId: string }
export interface RoomCreateRequest { theme: BoothTheme }
export interface RoomReadyRequest { ready: boolean }
export interface RoomError { code: RoomErrorCode; message: string; roomId?: string }
export interface RoomParticipantJoined { participant: RoomParticipant; room: RoomSnapshot }
export interface RoomParticipantLeft { participantId: string; reason: "left" | "disconnected"; room: RoomSnapshot }
export interface RoomLeft { roomId: string }

export interface ClientToServerEvents {
  "room:create": (request: RoomCreateRequest) => void;
  "room:join": (request: RoomJoinRequest) => void;
  "room:leave": () => void;
  "room:ready": (request: RoomReadyRequest) => void;
}

export interface ServerToClientEvents {
  "room:created": (membership: RoomMembership) => void;
  "room:joined": (membership: RoomMembership) => void;
  "room:user-joined": (event: RoomParticipantJoined) => void;
  "room:user-left": (event: RoomParticipantLeft) => void;
  "room:state": (room: RoomSnapshot) => void;
  "room:left": (event: RoomLeft) => void;
  "room:error": (error: RoomError) => void;
}

export interface InterServerEvents {}
export interface PhotoboothSocketData { roomId?: string; participantId?: string }
