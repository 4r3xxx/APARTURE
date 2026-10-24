"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/site-header";
import { formatRoomId } from "@/lib/room";
import { socket } from "@/lib/socket";

export default function CreateRoomPage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [copyState, setCopyState] = useState("Copy invite link");
  const creationRequested = useRef(false);

  useEffect(() => {
    const onConnect = () => {
      setConnectionError("");
      if (!creationRequested.current) return;
      creationRequested.current = false;
      socket.emit("room:create");
    };
    const onCreated = ({ room }: { room: { id: string } }) => {
      setRoomId(room.id);
      setCreating(false);
      creationRequested.current = false;
    };
    const onRoomError = ({ message }: { message: string }) => {
      setConnectionError(message);
      setCreating(false);
      creationRequested.current = false;
    };
    const onConnectError = () => {
      setConnectionError("We couldn’t reach the booth server. Check that it’s running, then try again.");
      setCreating(false);
      creationRequested.current = false;
    };

    socket.on("connect", onConnect);
    socket.on("room:created", onCreated);
    socket.on("room:error", onRoomError);
    socket.on("connect_error", onConnectError);
    return () => {
      socket.off("connect", onConnect);
      socket.off("room:created", onCreated);
      socket.off("room:error", onRoomError);
      socket.off("connect_error", onConnectError);
    };
  }, []);

  function handleCreate() {
    if (creating || roomId) return;
    setConnectionError("");
    setCreating(true);
    creationRequested.current = true;
    if (socket.connected) {
      creationRequested.current = false;
      socket.emit("room:create");
    } else {
      socket.connect();
    }
  }

  async function copyInvite() {
    if (!roomId) return;
    const invite = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(invite);
      setCopyState("Link copied!");
    } catch {
      setCopyState("Copy the room link from your address bar");
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="flow-page page-shell">
        <Link className="back-link" href="/">← Back to home</Link>
        <section className="flow-card create-card" aria-labelledby="create-title">
          <div className="flow-illustration flow-illustration--create" aria-hidden="true"><span>✿</span><span>◉</span><span>✦</span></div>
          <p className="eyebrow">Your own little corner</p>
          <h1 id="create-title">Start a photobooth</h1>
          <p className="flow-description">We’ll make a private room link for you. Send it to your person, then meet them in the booth.</p>

          {!roomId ? (
            <>
              <button className="button button--primary flow-submit" disabled={creating} onClick={handleCreate} type="button">{creating ? "Making your room…" : "Create my room"} {!creating && <span aria-hidden="true">↗</span>}</button>
              {connectionError && <p className="form-error" role="alert">{connectionError}</p>}
            </>
          ) : (
            <div className="created-room" aria-live="polite">
              <p className="created-room-label">Your room code</p>
              <p className="room-code">{formatRoomId(roomId)}</p>
              <button className="button button--secondary flow-submit" onClick={copyInvite} type="button">{copyState}</button>
              <Link className="button button--primary flow-submit" href={`/room/${roomId}`}>Open the waiting room <span aria-hidden="true">→</span></Link>
            </div>
          )}

          <p className="privacy-note"><span aria-hidden="true">✦</span> Your room link is made just for this booth.</p>
        </section>
        <p className="flow-footnote">Room invites and ready status work live. Camera setup and the shared countdown come next.</p>
      </main>
    </>
  );
}
