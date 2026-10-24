"use client";

import { useEffect, useRef, useState } from "react";

type LayoutId = "strip-2" | "strip-3" | "strip-4" | "4r-grid" | "4r-split" | "4r-3a" | "4r-3b" | "4r-2";
type FilterId = "none" | "romantic" | "clean" | "nature" | "sunlit" | "mono" | "noir" | "silver";
type CameraStatus = "waiting" | "requesting" | "ready" | "denied" | "missing" | "busy" | "unsupported" | "error" | "ended";

const LAYOUTS: { id: LayoutId; name: string; detail: string; poses: number; size: "strip" | "4r" }[] = [
  { id: "strip-2", name: "Strip · 2 Pose", detail: "6×2″ — two side-by-side", poses: 2, size: "strip" },
  { id: "strip-3", name: "Strip · 3 Pose", detail: "6×2″ — three in a row", poses: 3, size: "strip" },
  { id: "strip-4", name: "Strip · 4 Pose", detail: "6×2″ — classic 4-photo", poses: 4, size: "strip" },
  { id: "4r-grid", name: "4R · 4 Pose Grid", detail: "6×4″ — 2×2 grid", poses: 4, size: "4r" },
  { id: "4r-split", name: "4R · 4 Pose Split", detail: "6×4″ — 1 large + 3", poses: 4, size: "4r" },
  { id: "4r-3a", name: "4R · 3 Pose A", detail: "6×4″ — 1 large + 2", poses: 3, size: "4r" },
  { id: "4r-3b", name: "4R · 3 Pose B", detail: "6×4″ — 2 + 1 large", poses: 3, size: "4r" },
  { id: "4r-2", name: "4R · 2 Pose", detail: "6×4″ — two large frames", poses: 2, size: "4r" },
];

const FILTERS: { id: FilterId; name: string; css: string; icon: string }[] = [
  { id: "none", name: "None", css: "none", icon: "○" },
  { id: "romantic", name: "Romantic", css: "sepia(.13) saturate(1.2) hue-rotate(325deg)", icon: "♡" },
  { id: "clean", name: "Clean", css: "brightness(1.08) saturate(.94) contrast(1.03)", icon: "✧" },
  { id: "nature", name: "Nature", css: "saturate(1.25) hue-rotate(-8deg) contrast(1.04)", icon: "✿" },
  { id: "sunlit", name: "Sunlit", css: "sepia(.16) saturate(1.15) brightness(1.08)", icon: "☼" },
  { id: "mono", name: "Mono", css: "grayscale(1)", icon: "◐" },
  { id: "noir", name: "Noir", css: "grayscale(1) contrast(1.38) brightness(.88)", icon: "◒" },
  { id: "silver", name: "Silver", css: "grayscale(.72) contrast(1.12) brightness(1.06)", icon: "◇" },
];

const CAMERA_COPY: Record<CameraStatus, { title: string; message: string }> = {
  waiting: { title: "Camera preview is ready when you are", message: "Your camera will start once you’re connected to the booth." },
  requesting: { title: "Starting your camera…", message: "Allow camera access in your browser to check the preview. Your microphone stays off." },
  ready: { title: "Camera is working", message: "Your live preview is ready. Your camera stays on this device." },
  denied: { title: "Camera permission needed", message: "Allow camera access in your browser settings, then try again. Your microphone is not used." },
  missing: { title: "No camera found", message: "Connect a camera to this device, then try again." },
  busy: { title: "Camera is busy", message: "Close other apps using the camera, then try again." },
  unsupported: { title: "Camera is unavailable here", message: "Open the booth on HTTPS or localhost in a browser that supports camera access." },
  error: { title: "We couldn’t start your camera", message: "Check your camera connection and browser permissions, then try again." },
  ended: { title: "Camera stopped", message: "The camera feed ended. Restart it to check the preview again." },
};

function cameraStatusForError(error: unknown): CameraStatus {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "error";
}

export default function RoomCameraSetup({ active }: { active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackEndedHandler = useRef<{ track: MediaStreamTrack; handler: () => void } | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("waiting");
  const [retryCount, setRetryCount] = useState(0);
  const [layout, setLayout] = useState<LayoutId>("strip-2");
  const [filter, setFilter] = useState<FilterId>("none");
  const selectedFilter = FILTERS.find((option) => option.id === filter) ?? FILTERS[0];
  const cameraCopy = CAMERA_COPY[cameraStatus];

  useEffect(() => {
    if (!active) {
      setCameraStatus("waiting");
      return;
    }

    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("unsupported");
      return;
    }

    setCameraStatus("requesting");
    void navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user" },
    }).then((stream) => {
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }

      const videoTrack = stream.getVideoTracks()[0];
      const handleTrackEnded = () => setCameraStatus("ended");
      videoTrack?.addEventListener("ended", handleTrackEnded);
      if (videoTrack) trackEndedHandler.current = { track: videoTrack, handler: handleTrackEnded };
      setCameraStatus("ready");
    }).catch((error: unknown) => {
      if (!cancelled) setCameraStatus(cameraStatusForError(error));
    });

    return () => {
      cancelled = true;
      const endedHandler = trackEndedHandler.current;
      if (endedHandler) {
        endedHandler.track.removeEventListener("ended", endedHandler.handler);
        trackEndedHandler.current = null;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [active, retryCount]);

  const canRetry = active && ["denied", "missing", "busy", "error", "ended"].includes(cameraStatus);

  return (
    <section className="room-camera-setup" aria-labelledby="camera-setup-title">
      <div className="room-camera-heading">
        <div>
          <p className="eyebrow">Before the countdown</p>
          <h2 id="camera-setup-title">Camera &amp; print setup</h2>
          <p>Check your camera and choose the look for your photo strip.</p>
        </div>
        <span className="camera-local-badge"><span aria-hidden="true">◉</span> Preview stays on this device</span>
      </div>

      <div className="room-camera-grid">
        <div className={`camera-preview camera-preview--${cameraStatus}`}>
          <video
            aria-label="Live camera preview"
            autoPlay
            className="camera-preview-video"
            playsInline
            ref={videoRef}
            style={{ filter: selectedFilter.css }}
            muted
          />
          {cameraStatus !== "ready" && (
            <div className="camera-preview-message" role="status">
              <span className="camera-preview-symbol" aria-hidden="true">{cameraStatus === "requesting" ? "◌" : "◉"}</span>
              <strong>{cameraCopy.title}</strong>
              <p>{cameraCopy.message}</p>
              {canRetry && <button className="button button--secondary camera-retry" onClick={() => setRetryCount((count) => count + 1)} type="button">Try camera again</button>}
            </div>
          )}
          {cameraStatus === "ready" && <span className="camera-ready-indicator"><i aria-hidden="true" /> Camera ready</span>}
        </div>

        <div className="camera-preferences">
          <fieldset className="layout-picker">
            <legend>Print layout</legend>
            <div className="layout-group">
              <p className="layout-group-title">Strip 6×2″</p>
              <div className="layout-options-grid">
                {LAYOUTS.filter((option) => option.size === "strip").map((option) => (
                  <button aria-pressed={layout === option.id} className={`layout-choice${layout === option.id ? " layout-choice--selected" : ""}`} key={option.id} onClick={() => setLayout(option.id)} type="button">
                    <span className="layout-card-preview" aria-hidden="true">
                      <span className={`layout-preview-frame layout-preview-frame--${option.id}`}>
                        {Array.from({ length: option.poses }, (_, index) => <i key={index} />)}
                      </span>
                    </span>
                    <span className="layout-choice-copy"><strong>{option.name}</strong><span>{option.detail}</span></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="layout-group">
              <p className="layout-group-title">4R 6×4″</p>
              <div className="layout-options-grid">
                {LAYOUTS.filter((option) => option.size === "4r").map((option) => (
                  <button aria-pressed={layout === option.id} className={`layout-choice${layout === option.id ? " layout-choice--selected" : ""}`} key={option.id} onClick={() => setLayout(option.id)} type="button">
                    <span className="layout-card-preview" aria-hidden="true">
                      <span className={`layout-preview-frame layout-preview-frame--${option.id}`}>
                        {Array.from({ length: option.poses }, (_, index) => <i key={index} />)}
                      </span>
                    </span>
                    <span className="layout-choice-copy"><strong>{option.name}</strong><span>{option.detail}</span></span>
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          <div className="filter-picker" role="group" aria-labelledby="camera-filter-title">
            <div className="filter-picker-heading"><p id="camera-filter-title">Camera filter</p><span>{selectedFilter.name}</span></div>
            <div className="filter-options">
              {FILTERS.map((option) => (
                <button aria-pressed={filter === option.id} className={`filter-choice${filter === option.id ? " filter-choice--selected" : ""}`} key={option.id} onClick={() => setFilter(option.id)} type="button">
                  <span className={`filter-swatch filter-swatch--${option.id}`} aria-hidden="true"><i>{option.icon}</i></span>
                  <span>{option.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
