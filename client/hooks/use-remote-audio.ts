import { logError, logInfo } from "@/utils/logger";
import React from "react";

/**
 * Hook for handling remote audio playback
 * Provides a safe way to attach and play remote audio tracks
 */
export function useRemoteAudio() {
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const playTrack = React.useCallback((track: MediaStreamTrack) => {
    if (!audioRef.current) {
      logError("Audio element not available for track playback");
      return;
    }

    logInfo("Attaching remote audio track", {
      trackId: track.id,
      trackKind: track.kind,
      trackEnabled: track.enabled,
      trackMuted: track.muted,
      trackReadyState: track.readyState,
    });

    const stream = new MediaStream([track]);
    audioRef.current.srcObject = stream;

    // ✨ FIX: Don't try to play immediately - let the global click handler do it
    // This avoids the "play() was interrupted because user hasn't interacted" error
    logInfo(
      "Remote audio track attached, waiting for user interaction to start playback"
    );
  }, []);

  return { audioRef, playTrack };
}
