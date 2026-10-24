"use client";

import { useEffect, useRef, useState } from "react";
import type { BoothTheme } from "@photobooth/shared";

const PARTICLES: Record<BoothTheme, string[]> = {
  halloween: ["🍂", "✦", "•", "🍁", "✧"],
  christmas: ["❄", "✦", "•", "❅", "✧"],
  summer: ["✦", "☼", "•", "✧", "✦"],
  valentines: ["♡", "✦", "♥", "✧", "♡"],
  aesthetic: ["✦", "✿", "•", "✧", "✿"],
  modern: ["▱", "▪", "•", "□", "◇"],
};

interface MusicProfile {
  chords: number[][];
  melody: number[];
  noteInterval: number;
  filterFrequency: number;
  voice: OscillatorType;
}

const MUSIC: Record<BoothTheme, MusicProfile> = {
  halloween: {
    chords: [[50, 53, 57], [46, 50, 53], [48, 51, 55], [50, 53, 57]],
    melody: [62, 65, 69, 72, 69, 65, 60, 62],
    noteInterval: 2300,
    filterFrequency: 1150,
    voice: "triangle",
  },
  christmas: {
    chords: [[55, 59, 62], [50, 54, 57], [52, 55, 59], [55, 59, 62]],
    melody: [67, 71, 74, 79, 76, 74, 71, 69],
    noteInterval: 1900,
    filterFrequency: 2100,
    voice: "sine",
  },
  summer: {
    chords: [[52, 56, 59], [47, 51, 54], [49, 52, 56], [52, 56, 59]],
    melody: [64, 68, 71, 76, 73, 71, 68, 66],
    noteInterval: 1700,
    filterFrequency: 1900,
    voice: "triangle",
  },
  valentines: {
    chords: [[53, 57, 60], [48, 52, 55], [50, 53, 57], [53, 57, 60]],
    melody: [65, 69, 72, 77, 74, 72, 69, 67],
    noteInterval: 2450,
    filterFrequency: 1650,
    voice: "sine",
  },
  aesthetic: {
    chords: [[50, 54, 57], [45, 49, 52], [47, 50, 54], [50, 54, 57]],
    melody: [62, 66, 69, 74, 71, 69, 66, 64],
    noteInterval: 2800,
    filterFrequency: 1350,
    voice: "sine",
  },
  modern: {
    chords: [[48, 52, 55], [43, 47, 50], [45, 48, 52], [48, 52, 55]],
    melody: [60, 64, 67, 72, 70, 67, 64, 62],
    noteInterval: 2050,
    filterFrequency: 1450,
    voice: "sine",
  },
};

interface MusicController {
  stop: () => void;
}

function midiFrequency(note: number) {
  return 440 * 2 ** ((note - 69) / 12);
}

function startThemeMusic(theme: BoothTheme): MusicController {
  const AudioContextConstructor = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("This browser does not support theme music.");

  const profile = MUSIC[theme];
  const context = new AudioContextConstructor();
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, context.currentTime);
  master.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.8);
  master.connect(context.destination);

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = profile.filterFrequency;
  filter.connect(master);

  const pad = profile.chords[0].map((note, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index === 0 ? "triangle" : "sine";
    oscillator.frequency.value = midiFrequency(note - 12);
    gain.gain.value = index === 0 ? 0.09 : 0.055;
    oscillator.connect(gain);
    gain.connect(filter);
    oscillator.start();
    return oscillator;
  });

  let chordIndex = 0;
  const chordTimer = window.setInterval(() => {
    chordIndex = (chordIndex + 1) % profile.chords.length;
    const chord = profile.chords[chordIndex];
    pad.forEach((oscillator, index) => {
      oscillator.frequency.setTargetAtTime(midiFrequency(chord[index] - 12), context.currentTime, 1.4);
    });
  }, 9500);

  let melodyIndex = 0;
  const playMelodyNote = () => {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const startAt = context.currentTime + 0.02;
    oscillator.type = profile.voice;
    oscillator.frequency.value = midiFrequency(profile.melody[melodyIndex]);
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(0.19, startAt + 0.08);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.8);
    oscillator.connect(envelope);
    envelope.connect(filter);
    oscillator.start(startAt);
    oscillator.stop(startAt + 1.85);
    melodyIndex = (melodyIndex + 1) % profile.melody.length;
  };
  playMelodyNote();
  const melodyTimer = window.setInterval(playMelodyNote, profile.noteInterval);

  void context.resume();
  let stopped = false;

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      window.clearInterval(chordTimer);
      window.clearInterval(melodyTimer);
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0.0001, context.currentTime, 0.08);
      window.setTimeout(() => { void context.close().catch(() => undefined); }, 400);
    },
  };
}

export default function ThemeAtmosphere({ theme }: { theme: BoothTheme }) {
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicError, setMusicError] = useState("");
  const controller = useRef<MusicController | null>(null);
  const playingRef = useRef(false);
  const lastTheme = useRef(theme);

  useEffect(() => () => {
    controller.current?.stop();
    controller.current = null;
    playingRef.current = false;
  }, []);

  useEffect(() => {
    if (lastTheme.current === theme) return;
    lastTheme.current = theme;
    if (!playingRef.current) return;

    controller.current?.stop();
    try {
      controller.current = startThemeMusic(theme);
      setMusicError("");
    } catch {
      controller.current = null;
      playingRef.current = false;
      setMusicPlaying(false);
      setMusicError("Theme music is unavailable in this browser.");
    }
  }, [theme]);

  function toggleMusic() {
    if (playingRef.current) {
      controller.current?.stop();
      controller.current = null;
      playingRef.current = false;
      setMusicPlaying(false);
      return;
    }

    try {
      controller.current = startThemeMusic(theme);
      playingRef.current = true;
      setMusicPlaying(true);
      setMusicError("");
    } catch {
      setMusicError("Theme music is unavailable in this browser.");
    }
  }

  return (
    <>
      <div className="theme-atmosphere" aria-hidden="true">
        <div className="theme-atmosphere-image" />
        <div className="theme-atmosphere-shade" />
        <div className="theme-atmosphere-particles">
          {Array.from({ length: 22 }, (_, index) => (
            <span
              className={`theme-particle theme-particle--${index % 5}`}
              key={`${theme}-${index}`}
              style={{
                left: `${(index * 37 + 9) % 100}%`,
                animationDelay: `${-((index * 7) % 19)}s`,
                animationDuration: `${15 + (index % 6) * 3}s`,
              }}
            >
              {PARTICLES[theme][index % PARTICLES[theme].length]}
            </span>
          ))}
        </div>
      </div>
      <button
        aria-label={`${musicPlaying ? "Pause" : "Play"} ${theme} theme music`}
        aria-pressed={musicPlaying}
        className={`theme-sound-toggle${musicPlaying ? " theme-sound-toggle--playing" : ""}`}
        onClick={toggleMusic}
        type="button"
      >
        <span className="theme-sound-icon" aria-hidden="true">{musicPlaying ? "♫" : "♪"}</span>
        <span>{musicPlaying ? "Music on" : "Music off"}</span>
      </button>
      {musicError && <span className="theme-sound-status" role="status">{musicError}</span>}
    </>
  );
}
