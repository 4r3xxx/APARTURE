"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/site-header";
import ThemeArtwork from "@/components/theme-artwork";
import { BOOTH_THEMES, DEFAULT_BOOTH_THEME } from "@/lib/themes";
import { formatRoomId } from "@/lib/room";
import { socket } from "@/lib/socket";
import type { BoothTheme } from "@photobooth/shared";

export default function CreateRoomPage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [copyState, setCopyState] = useState("Copy invite link");
  const [theme, setTheme] = useState<BoothTheme>(DEFAULT_BOOTH_THEME);
  const creationRequested = useRef(false);

  useEffect(() => {
    const themeId = window.location.hash.replace("#theme-", "");
    const requestedTheme = BOOTH_THEMES.find((option) => option.id === themeId);
    if (requestedTheme) setTheme(requestedTheme.id);
  }, []);

  useEffect(() => {
    const onConnect = () => {
      setConnectionError("");
      if (!creationRequested.current) return;
      creationRequested.current = false;
      socket.emit("room:create", { theme });
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
  }, [theme]);

  function handleCreate() {
    if (creating || roomId) return;
    setConnectionError("");
    setCreating(true);
    creationRequested.current = true;
    if (socket.connected) {
      creationRequested.current = false;
      socket.emit("room:create", { theme });
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
    <div className="theme-shell" data-booth-theme={theme}>
      <SiteHeader />
      <main className="flow-page page-shell">
        <Link className="back-link" href="/">← Back to home</Link>
        <section className="flow-card create-card" aria-labelledby="create-title">
          <div className="flow-illustration flow-illustration--create" aria-hidden="true"><span>✿</span><span>◉</span><span>✦</span></div>
          <p className="eyebrow">Your own little corner</p>
          <h1 id="create-title">Start a photobooth</h1>
          <p className="flow-description">We’ll make a private room link for you. Send it to your person, then meet them in the booth.</p>

          {!roomId && (
            <div className="theme-picker" role="group" aria-labelledby="theme-picker-title">
              <div className="theme-picker-heading">
                <div><p className="eyebrow">Set the scene</p><h2 id="theme-picker-title">Choose your booth mood</h2></div>
                <span className="theme-picked-label">{BOOTH_THEMES.find((option) => option.id === theme)?.name}</span>
              </div>
              <div className="theme-picker-grid">
                {BOOTH_THEMES.map((option) => (
                  <button
                    aria-pressed={theme === option.id}
                    className={`theme-choice${theme === option.id ? " theme-choice--selected" : ""}`}
                    id={`theme-${option.id}`}
                    key={option.id}
                    onClick={() => setTheme(option.id)}
                    type="button"
                  >
                    <ThemeArtwork theme={option.id} compact />
                    <span className="theme-choice-copy"><strong>{option.name}</strong><span>{option.description}</span></span>
                    <span className="theme-choice-check" aria-hidden="true">✓</span>
                  </button>
                ))}
              </div>
            </div>
          )}

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
    </div>
  );
}
