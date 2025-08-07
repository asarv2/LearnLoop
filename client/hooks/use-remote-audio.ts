import { logError, logInfo } from "@/utils/logger";
import { useCallback, useRef } from "react";

/**
 * Simplified hook for handling remote audio playback.
 * Focuses on continuous server audio with simple microphone control.
 */
export function useRemoteAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Simple function to attach and play remote audio track
  const playTrack = useCallback((track: MediaStreamTrack) => {
    const audio = audioRef.current;
    if (!audio) {
      logError("Audio element not available");
      return;
    }

    logInfo("Attaching remote audio track for continuous playback", {
      trackId: track.id,
      readyState: track.readyState,
    });

    // Attach the track to the audio element
    audio.srcObject = new MediaStream([track]);

    // Force unmute and set volume - be aggressive about this
    audio.muted = false;
    audio.volume = 1;

    // Double-check muted state after a short delay
    setTimeout(() => {
      if (audio.muted) {
        logInfo("Audio element was muted, forcing unmute");
        audio.muted = false;
      }
    }, 100);

    // Try to start playback immediately
    audio
      .play()
      .then(() => logInfo("🔊 Server audio started playing"))
      .catch(() => {
        logInfo(
          "Server audio ready, waiting for user interaction to start playback"
        );
        // This is expected - browser requires user interaction
      });

    // Set up event listeners for track state changes
    track.onunmute = () => {
      logInfo("Server track unmuted - attempting to play");
      audio.muted = false; // Ensure it's not muted
      audio.play().catch((e) => logError("Play failed on unmute", e));
    };

    track.onended = () => {
      logInfo("Server audio track ended");
    };
  }, []);

  // Helper function to get current track state for debugging
  const getTrackState = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.srcObject) return null;

    const stream = audio.srcObject as MediaStream;
    const track = stream.getAudioTracks()[0];
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
