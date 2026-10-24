import { Suspense } from "react";
import SiteHeader from "@/components/site-header";
import WaitingRoom from "@/components/waiting-room";

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  return (
    <Suspense fallback={<RoomLoading />}>
      <RoomContent params={params} />
    </Suspense>
  );
}

async function RoomContent({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <WaitingRoom roomId={roomId} />;
}

function RoomLoading() {
  return (
    <>
      <SiteHeader />
      <main className="waiting-page page-shell room-loading" aria-live="polite">
        <span className="loading-flower" aria-hidden="true">✿</span>
        <p>Getting your booth ready…</p>
      </main>
    </>
  );
}
