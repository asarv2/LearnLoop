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

    // Initially pause and mute the audio - will be controlled by voice mode
    audio.pause();
    audio.muted = true;
    audio.volume = 1;

    logInfo("Server audio track attached but paused and muted initially");

    // Set up event listeners for track state changes
    track.onunmute = () => {
      logInfo("Server track unmuted");
    };

    track.onended = () => {
      logInfo("Server audio track ended");
    };
  }, []);

  // Function to enable server audio (unpause and unmute)
  const enableServerAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      logError("Audio element not available for enabling");
      return;
    }

    audio.muted = false;
    audio
      .play()
      .then(() => {
        logInfo("🔊 Server audio enabled and playing");
      })
      .catch((e) => {
        logError("Failed to enable server audio", e);
      });
  }, []);

  // Function to disable server audio (pause and mute)
  const disableServerAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      logError("Audio element not available for disabling");
      return;
    }

    audio.pause();
    audio.muted = true;
    logInfo("🔇 Server audio disabled (paused and muted)");
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

  return {
    audioRef,
    playTrack,
    getTrackState,
    enableServerAudio,
    disableServerAudio,
  };
}
