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
  padVoice: OscillatorType;
  padGain: number;
  noteGain: number;
  noteDuration: number;
  style: "haunted" | "festive" | "coastal" | "romantic" | "dreamy" | "minimal";
}

const MUSIC: Record<BoothTheme, MusicProfile> = {
  halloween: {
    chords: [[50, 53, 56], [46, 50, 53], [48, 51, 54], [50, 53, 56]],
    melody: [62, 63, 68, 69, 63, 62, 56, 57],
    noteInterval: 2850,
    filterFrequency: 780,
    voice: "sawtooth",
    padVoice: "triangle",
    padGain: 0.06,
    noteGain: 0.09,
    noteDuration: 2.35,
    style: "haunted",
  },
  christmas: {
    chords: [[55, 59, 62], [50, 54, 57], [52, 55, 59], [55, 59, 62]],
    melody: [74, 78, 81, 86, 83, 81, 78, 76],
    noteInterval: 1750,
    filterFrequency: 2800,
    voice: "sine",
    padVoice: "sine",
    padGain: 0.055,
    noteGain: 0.14,
    noteDuration: 1.15,
    style: "festive",
  },
  summer: {
    chords: [[52, 56, 59], [49, 52, 56], [47, 51, 54], [52, 56, 59]],
    melody: [76, 79, 83, 88, 86, 83, 79, 76],
    noteInterval: 1450,
    filterFrequency: 3200,
    voice: "triangle",
    padVoice: "sine",
    padGain: 0.045,
    noteGain: 0.12,
    noteDuration: 0.9,
    style: "coastal",
  },
  valentines: {
    chords: [[53, 57, 60], [48, 52, 55], [45, 48, 52], [50, 53, 57]],
    melody: [72, 76, 79, 84, 81, 79, 76, 74],
    noteInterval: 2550,
    filterFrequency: 2200,
    voice: "sine",
    padVoice: "triangle",
    padGain: 0.065,
    noteGain: 0.105,
    noteDuration: 2.1,
    style: "romantic",
  },
  aesthetic: {
    chords: [[50, 54, 57], [45, 49, 52], [47, 50, 54], [45, 50, 54]],
    melody: [69, 74, 76, 81, 78, 74, 73, 69],
    noteInterval: 3050,
    filterFrequency: 1700,
    voice: "sine",
    padVoice: "sine",
    padGain: 0.045,
    noteGain: 0.075,
    noteDuration: 2.8,
    style: "dreamy",
  },
  modern: {
    chords: [[48, 52, 55], [43, 47, 50], [45, 48, 52], [48, 52, 55]],
    melody: [72, 79, 84, 82, 79, 76, 74, 81],
    noteInterval: 2150,
    filterFrequency: 2300,
    voice: "triangle",
    padVoice: "sawtooth",
    padGain: 0.035,
    noteGain: 0.09,
    noteDuration: 0.72,
    style: "minimal",
  },
};

interface MusicController {
  stop: () => void;
}

function midiFrequency(note: number) {
  return 440 * 2 ** ((note - 69) / 12);
}

function addHauntedTexture(context: AudioContext, destination: AudioNode) {
  const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;

  const wind = context.createBufferSource();
  wind.buffer = buffer;
  wind.loop = true;
  const windFilter = context.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 420;
  windFilter.Q.value = 0.7;
  const windGain = context.createGain();
  windGain.gain.value = 0.012;
  wind.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(destination);
  wind.start();

  const drone = context.createOscillator();
  const droneGain = context.createGain();
  drone.type = "triangle";
  drone.frequency.value = midiFrequency(38);
  droneGain.gain.value = 0.025;
  drone.connect(droneGain);
  droneGain.connect(destination);
  drone.start();

  const pulse = context.createOscillator();
  const pulseDepth = context.createGain();
  pulse.frequency.value = 0.13;
  pulseDepth.gain.value = 0.012;
  pulse.connect(pulseDepth);
  pulseDepth.connect(windGain.gain);
  pulse.start();
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
    oscillator.type = profile.padVoice;
    oscillator.frequency.value = midiFrequency(note - 12);
    gain.gain.value = profile.padGain / (index === 0 ? 1 : 1.6);
    oscillator.connect(gain);
    gain.connect(filter);
    oscillator.start();
    return oscillator;
  });

  if (profile.style === "haunted") addHauntedTexture(context, master);

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
    envelope.gain.exponentialRampToValueAtTime(profile.noteGain, startAt + (profile.style === "dreamy" ? 0.32 : 0.08));
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + profile.noteDuration);
    oscillator.connect(envelope);
    envelope.connect(filter);
    oscillator.start(startAt);
    oscillator.stop(startAt + profile.noteDuration + 0.05);

    if (profile.style === "festive" || profile.style === "coastal") {
      const overtone = context.createOscillator();
      const overtoneGain = context.createGain();
      overtone.type = "sine";
      overtone.frequency.value = midiFrequency(profile.melody[melodyIndex] + 12);
      overtoneGain.gain.setValueAtTime(0.0001, startAt);
      overtoneGain.gain.exponentialRampToValueAtTime(profile.noteGain * 0.24, startAt + 0.025);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startAt + profile.noteDuration * 0.7);
      overtone.connect(overtoneGain);
      overtoneGain.connect(filter);
      overtone.start(startAt);
      overtone.stop(startAt + profile.noteDuration * 0.7 + 0.05);
    }

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

  const themeName = theme === "christmas" ? "Holidays" : theme === "valentines" ? "Valentine’s" : theme[0].toUpperCase() + theme.slice(1);

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
        aria-label={`${musicPlaying ? "Pause" : "Play"} ${themeName} theme music`}
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
