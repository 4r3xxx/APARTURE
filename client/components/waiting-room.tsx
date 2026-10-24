"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/site-header";
import ThemeArtwork from "@/components/theme-artwork";
import { formatRoomId } from "@/lib/room";
import { socket } from "@/lib/socket";
import { BOOTH_THEMES, DEFAULT_BOOTH_THEME } from "@/lib/themes";
import type { RoomError, RoomMembership, RoomParticipantJoined, RoomParticipantLeft, RoomSnapshot } from "@photobooth/shared";

const validRoomId = /^[a-f0-9]{32}$/i;

export default function WaitingRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [selfParticipantId, setSelfParticipantId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [roomError, setRoomError] = useState<RoomError | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [copyState, setCopyState] = useState("Copy invite link");
  const isValid = validRoomId.test(roomId);
  const self = room?.participants.find((participant) => participant.id === selfParticipantId) ?? null;
  const other = room?.participants.find((participant) => participant.id !== selfParticipantId) ?? null;
  const activeTheme = BOOTH_THEMES.find((option) => option.id === room?.theme) ?? BOOTH_THEMES[BOOTH_THEMES.length - 1];

  useEffect(() => {
    if (!isValid) {
      setConnectionStatus("error");
      return;
    }

    const applyMembership = ({ room: nextRoom, selfParticipantId: participantId }: RoomMembership) => {
      if (nextRoom.id !== roomId) return;
      setRoom(nextRoom);
      setSelfParticipantId(participantId);
      setRoomError(null);
      setConnectionStatus("connected");
    };
    const applyRoomState = (nextRoom: RoomSnapshot) => {
      if (nextRoom.id !== roomId) return;
      setRoom(nextRoom);
      setRoomError(null);
      setConnectionStatus("connected");
    };
    const applyParticipantJoined = ({ room: nextRoom }: RoomParticipantJoined) => applyRoomState(nextRoom);
    const applyParticipantLeft = ({ room: nextRoom }: RoomParticipantLeft) => applyRoomState(nextRoom);
    const onRoomError = (error: RoomError) => {
      setRoomError(error);
      setConnectionStatus("error");
      setLeaving(false);
    };
    const onConnect = () => {
      setRoomError(null);
      setConnectionStatus("connected");
      socket.emit("room:join", { roomId });
    };
    const onConnectError = () => {
      setConnectionStatus("reconnecting");
      setRoomError({ code: "SERVER_UNAVAILABLE", message: "We couldn’t reach the booth server. Check your connection and try again.", roomId });
    };
    const onDisconnect = () => setConnectionStatus("reconnecting");

    socket.on("room:created", applyMembership);
    socket.on("room:joined", applyMembership);
    socket.on("room:state", applyRoomState);
    socket.on("room:user-joined", applyParticipantJoined);
    socket.on("room:user-left", applyParticipantLeft);
    socket.on("room:error", onRoomError);
    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off("room:created", applyMembership);
      socket.off("room:joined", applyMembership);
      socket.off("room:state", applyRoomState);
      socket.off("room:user-joined", applyParticipantJoined);
      socket.off("room:user-left", applyParticipantLeft);
      socket.off("room:error", onRoomError);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
    };
  }, [isValid, roomId]);

  useEffect(() => {
    const onRoomLeft = ({ roomId: leftRoomId }: { roomId: string }) => {
      if (leftRoomId !== roomId) return;
      socket.disconnect();
      router.replace("/");
    };
    socket.on("room:left", onRoomLeft);
    return () => { socket.off("room:left", onRoomLeft); };
  }, [roomId, router]);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("Link copied!");
    } catch {
      setCopyState("Copy the link from your address bar");
    }
  }

  function toggleReady() {
    if (!self || connectionStatus !== "connected") return;
    socket.emit("room:ready", { ready: !self.ready });
  }

  function leaveRoom() {
    if (!socket.connected || !self) {
      socket.disconnect();
      router.replace("/");
      return;
    }
    setLeaving(true);
    socket.emit("room:leave");
  }

  const showRoomErrorCard = !isValid || roomError?.code === "ROOM_NOT_FOUND" || roomError?.code === "INVALID_ROOM_ID" || roomError?.code === "ROOM_EXPIRED" || roomError?.code === "ROOM_FULL";

  return (
    <div className="theme-shell" data-booth-theme={room?.theme ?? DEFAULT_BOOTH_THEME}>
      <SiteHeader />
      <main className="waiting-page page-shell">
        <button className="back-link back-link-button" disabled={leaving} onClick={leaveRoom} type="button">← {leaving ? "Leaving the booth…" : "Leave the booth"}</button>
        {showRoomErrorCard ? (
          <section className="flow-card invalid-room" aria-labelledby="invalid-room-title">
            <p className="eyebrow">{roomError?.code === "ROOM_FULL" ? "This booth is full" : "Hmm, we can’t open that booth"}</p>
            <h1 id="invalid-room-title">{roomError?.message ?? "This invite looks a little off."}</h1>
            <p className="flow-description">{roomError?.code === "ROOM_FULL" ? "A photobooth has two seats. Ask your person to leave before trying again." : "Check the room link and try again, or ask your person to make a fresh room."}</p>
            <Link className="button button--primary flow-submit" href="/join">Enter another room code</Link>
          </section>
        ) : (
          <>
            <div className="waiting-heading">
              <p className="eyebrow"><span className="eyebrow-dot" /> YOUR PRIVATE BOOTH</p>
              <h1>Good things are <span>developing.</span></h1>
              <p>Invite your person in. This room is ready when you are.</p>
            </div>
            <div className="room-theme-banner">
              <ThemeArtwork theme={activeTheme.id} />
              <div><p className="eyebrow">THIS BOOTH’S MOOD</p><h2>{activeTheme.name}</h2><span>{activeTheme.description}</span></div>
              <span className="room-theme-spark" aria-hidden="true">✦</span>
            </div>
            <section className="room-panel" aria-labelledby="room-title">
              <div className="room-panel-top">
                <div><p className="eyebrow">Room code</p><h2 id="room-title">{formatRoomId(roomId)}</h2></div>
                <button className="button button--secondary copy-button" onClick={copyInvite} type="button">{copyState}</button>
              </div>
              <div className={`preview-notice ${roomError ? "preview-notice--error" : ""}`} role={roomError ? "alert" : "status"}>
                <span aria-hidden="true">{roomError ? "!" : "✦"}</span>
                <p><strong>{roomError ? "Room connection issue" : connectionStatus === "connected" ? "You’re connected to this booth" : "Connecting to your booth…"}</strong><br />{roomError?.message ?? (other ? "Your person is here. You can both mark yourselves ready." : "Share your invite link. Your person will appear here when they join.")}</p>
              </div>
              <div className="guest-grid">
                <article className={`guest-card ${self?.ready ? "guest-card--ready" : ""}`}>
                  <div className="guest-avatar guest-avatar--you"><span aria-hidden="true">☺</span>{self?.ready && <i aria-label="Ready">✓</i>}</div>
                  <p className="guest-role">YOU</p><h3>{self ? "You" : "Joining…"}</h3>
                  <p className="guest-status">{self ? (self.ready ? "Marked ready for the session" : "Camera setup comes next") : "Connecting to this room"}</p>
                  <button aria-pressed={self?.ready ?? false} className={`button ${self?.ready ? "button--secondary" : "button--primary"} guest-action`} disabled={!self || connectionStatus !== "connected" || Boolean(roomError)} onClick={toggleReady} type="button">{self?.ready ? "I’m ready ✓" : "I’m ready"}</button>
                </article>
                <article className="guest-card guest-card--waiting">
                  <div className="guest-avatar guest-avatar--friend"><span aria-hidden="true">{other ? "☺" : "✿"}</span><i aria-hidden="true">{other?.ready ? "✓" : other ? "•" : "…"}</i></div>
                  <p className="guest-role">YOUR PERSON</p><h3>{other ? (other.ready ? "Ready" : "In the booth") : "Spot saved"}</h3>
                  <p className="guest-status">{other ? (other.ready ? "Ready for the session" : "Camera setup comes next") : "They’ll appear here when they join."}</p>
                  <button className="button button--secondary guest-action" onClick={copyInvite} type="button">{copyState}</button>
                </article>
              </div>
              <div className="room-panel-bottom"><span><i className="online-dot" /> {other ? "Both people are connected" : "Waiting for your person"}</span><span>{room?.participants.length ?? 0} of 2 people in this booth</span></div>
            </section>
            <p className="waiting-footnote">Tip: send the invite link in your favorite chat. The room code works too.</p>
          </>
        )}
      </main>
    </div>
  );
}
