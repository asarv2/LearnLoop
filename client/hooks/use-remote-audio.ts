import { logError } from "@/utils/logger";
import React from "react";

/**
 * Hook for handling remote audio playback
 * Provides a safe way to attach and play remote audio tracks
 */
export function useRemoteAudio() {
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const playTrack = React.useCallback((track: MediaStreamTrack) => {
    if (!audioRef.current) return;

    const stream = new MediaStream([track]);
    audioRef.current.srcObject = stream;

    // try() because Chrome still throws until user clicks once.
    audioRef.current.play().catch((error) => {
      logError(
        "Audio playback failed - user interaction may be required",
        error
      );
    });
  }, []);

  return { audioRef, playTrack };
}
