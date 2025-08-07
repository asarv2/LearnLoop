import { logError, logInfo } from "@/utils/logger";
import React from "react";

/**
 * Hook for handling remote audio playback
 * Provides a safe way to attach and play remote audio tracks
 */
export function useRemoteAudio() {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = React.useRef<MediaStreamTrack | null>(null);

  const playTrack = React.useCallback((track: MediaStreamTrack) => {
    const audio = audioRef.current;
    if (!audio) {
      logError("Audio element not available for track playback");
      return;
    }

    // Cache the track for debugging
    currentTrackRef.current = track;

    logInfo("Attaching remote audio track", {
      trackId: track.id,
      trackKind: track.kind,
      trackEnabled: track.enabled,
      trackMuted: track.muted,
      trackReadyState: track.readyState,
    });

    // Attach the track
    audio.srcObject = new MediaStream([track]);
    audio.muted = false; // 🔑 make sure the element isn't muted
    audio.volume = 1;

    // Start as soon as the track is ready or when it becomes un-muted
    const start = () =>
      audio
        .play()
        .then(() => logInfo("🔊 remote audio playing"))
        .catch((e) => logError("play() failed", e));

    if (!track.muted && track.readyState === "live") {
      start();
    } else {
      track.onunmute = start; // wait until server unmutes the track
    }
  }, []);

  // Helper function to get current track state for debugging
  const getTrackState = React.useCallback(() => {
    const track = currentTrackRef.current;
    if (!track) return null;

    return {
      id: track.id,
      kind: track.kind,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
    };
  }, []);

  return { audioRef, playTrack, getTrackState };
}
