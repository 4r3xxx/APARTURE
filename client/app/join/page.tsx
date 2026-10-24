"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import SiteHeader from "@/components/site-header";
import { parseRoomId } from "@/lib/room";

export default function JoinRoomPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const roomId = parseRoomId(roomCode);
    if (!roomId) {
      setError("That room code doesn’t look right. Check the link or enter all 32 characters.");
      return;
    }
    router.push(`/room/${roomId}`);
  }

  return (
    <>
      <SiteHeader />
      <main className="flow-page page-shell">
        <Link className="back-link" href="/">← Back to home</Link>
        <section className="flow-card join-card" aria-labelledby="join-title">
          <div className="flow-illustration flow-illustration--join" aria-hidden="true"><span>↗</span><span>♡</span></div>
          <p className="eyebrow">Someone saved you a spot</p>
          <h1 id="join-title">Join their photobooth</h1>
          <p className="flow-description">Paste the room link or type in the room code they sent you.</p>
          <form className="join-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="room-code-input">Room link or code</label>
            <input
              autoComplete="off"
              autoCapitalize="none"
              id="room-code-input"
              inputMode="text"
              onChange={(event) => { setRoomCode(event.target.value); setError(""); }}
              placeholder="Paste the invite link or 32-character code"
              value={roomCode}
              aria-describedby={error ? "room-code-error" : "room-code-hint"}
              aria-invalid={Boolean(error)}
            />
            {error ? <p className="form-error" id="room-code-error" role="alert">{error}</p> : <p className="field-hint" id="room-code-hint">You can paste the whole invite link.</p>}
            <button className="button button--primary flow-submit" type="submit">Join the room <span aria-hidden="true">→</span></button>
          </form>
          <p className="privacy-note"><span aria-hidden="true">✦</span> No account needed. Just bring your best pose.</p>
        </section>
      </main>
    </>
  );
}
