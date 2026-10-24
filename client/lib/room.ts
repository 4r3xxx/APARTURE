const ROOM_ID_PATTERN = /^[a-f0-9]{32}$/i;

export function parseRoomId(input: string): string | null {
  const value = input.trim();
  const match = value.match(/\/room\/([a-f0-9]{32})(?:[/?#]|$)/i);
  const candidate = (match?.[1] ?? value).replace(/[\s-]/g, "");
  return ROOM_ID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

export function formatRoomId(roomId: string): string {
  return roomId.match(/.{1,8}/g)?.join("-") ?? roomId;
}
