"use client";
import { useWebSocket } from "@/contexts/websocket-context";
import { logInfo } from "@/utils/logger";
import { Box, Button, Card, Flex, Text } from "@radix-ui/themes";
import React, { useEffect, useState } from "react";

interface WebRTCDebugPanelProps {
  audioPlaybackRef: React.RefObject<HTMLAudioElement | null>;
}

export default function WebRTCDebugPanel({
  audioPlaybackRef,
}: WebRTCDebugPanelProps) {
  const { isWebRTCConnected, getTrackState, setMicrophoneMuted } =
    useWebSocket();
  const [audioState, setAudioState] = useState({
    paused: true,
    muted: false,
    volume: 1,
    readyState: 0,
    networkState: 0,
    error: null as string | null,
  });

  const [micMuted, setMicMuted] = useState(false);

  const [trackInfo, setTrackInfo] = useState<{
    id: string;
    kind: string;
    enabled: boolean;
    muted: boolean;
    readyState: string;
  } | null>(null);

  useEffect(() => {
    const updateAudioState = () => {
      if (audioPlaybackRef.current) {
        const audio = audioPlaybackRef.current;
        setAudioState({
          paused: audio.paused,
          muted: audio.muted,
          volume: audio.volume,
          readyState: audio.readyState,
          networkState: audio.networkState,
          error: audio.error ? audio.error.message : null,
        });
      }
    };

    // Update state immediately
    updateAudioState();

    // Set up event listeners
    const audio = audioPlaybackRef.current;
    if (audio) {
      const events = [
        "loadstart",
        "loadedmetadata",
        "canplay",
        "canplaythrough",
        "play",
        "playing",
        "pause",
        "volumechange",
        "error",
      ];
      events.forEach((event) => {
        audio.addEventListener(event, updateAudioState);
      });

      return () => {
        events.forEach((event) => {
          audio.removeEventListener(event, updateAudioState);
        });
      };
    }
  }, [audioPlaybackRef]);

  // Update track info periodically
  useEffect(() => {
    const updateTrackInfo = () => {
      const trackState = getTrackState();
      setTrackInfo(trackState);
    };

    // Update immediately
    updateTrackInfo();

    // Update every 500ms
    const interval = setInterval(updateTrackInfo, 500);

    return () => clearInterval(interval);
  }, [getTrackState]);

  const getReadyStateText = (state: number) => {
    const states = [
      "HAVE_NOTHING",
      "HAVE_METADATA",
      "HAVE_CURRENT_DATA",
      "HAVE_FUTURE_DATA",
      "HAVE_ENOUGH_DATA",
    ];
    return states[state] || "UNKNOWN";
  };

  const getNetworkStateText = (state: number) => {
    const states = [
      "NETWORK_EMPTY",
      "NETWORK_IDLE",
      "NETWORK_LOADING",
      "NETWORK_NO_SOURCE",
    ];
    return states[state] || "UNKNOWN";
  };

  const testAudioPlayback = () => {
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current
        .play()
        .then(() => {
          logInfo("Test audio playback started successfully");
        })
        .catch((e) => {
          logInfo("Test audio playback failed", e);
        });
    }
  };

  const openWebRTCInternals = () => {
    window.open("chrome://webrtc-internals", "_blank");
  };

  return (
    <Card size="2" style={{ margin: "16px", background: "var(--gray-1)" }}>
      <Flex direction="column" gap="3">
        <Text size="3" weight="bold" style={{ color: "var(--gray-12)" }}>
          🔧 WebRTC Debug Panel
        </Text>

        <Flex gap="2" wrap="wrap">
          <Button size="1" onClick={testAudioPlayback}>
            Test Audio Playback
          </Button>
          <Button size="1" onClick={openWebRTCInternals}>
            Open WebRTC Internals
          </Button>
          <Button
            size="1"
            onClick={() => {
              if (audioPlaybackRef.current) {
                const audio = audioPlaybackRef.current;
                audio.muted = false;
                audio.volume = 1;
                if (audio.paused) {
                  audio.play().catch((e) => logInfo("Force play failed", e));
                }
                logInfo("Manually set audio element: muted=false, volume=1");
              }
            }}
          >
            Force Unmute
          </Button>
          <Button
            size="1"
            onClick={() => {
              const newMutedState = !micMuted;
              setMicMuted(newMutedState);
              setMicrophoneMuted(newMutedState);
              logInfo(
                `Microphone test: ${newMutedState ? "muted" : "unmuted"}`
              );
            }}
          >
            {micMuted ? "Unmute Mic" : "Mute Mic"}
          </Button>
        </Flex>

        <Box>
          <Text size="2" weight="bold" style={{ color: "var(--gray-11)" }}>
            Connection Status:
          </Text>
          <Text
            size="2"
            style={{
              color: isWebRTCConnected ? "var(--green-11)" : "var(--red-11)",
            }}
          >
            {isWebRTCConnected ? "✅ Connected" : "❌ Disconnected"}
          </Text>
        </Box>

        <Box>
          <Text size="2" weight="bold" style={{ color: "var(--gray-11)" }}>
            Audio Element State:
          </Text>
          <Flex direction="column" gap="1">
            <Text size="1">Paused: {audioState.paused ? "❌" : "✅"}</Text>
            <Text size="1">Muted: {audioState.muted ? "❌" : "✅"}</Text>
            <Text size="1">Volume: {audioState.volume}</Text>
            <Text size="1">
              Ready State: {getReadyStateText(audioState.readyState)}
            </Text>
            <Text size="1">
              Network State: {getNetworkStateText(audioState.networkState)}
            </Text>
            {audioState.error && (
              <Text size="1" style={{ color: "var(--red-11)" }}>
                Error: {audioState.error}
              </Text>
            )}
          </Flex>
        </Box>

        {trackInfo && (
          <Box>
            <Text size="2" weight="bold" style={{ color: "var(--gray-11)" }}>
              Audio Track Info:
            </Text>
            <Flex direction="column" gap="1">
              <Text size="1">ID: {trackInfo.id}</Text>
              <Text size="1">Kind: {trackInfo.kind}</Text>
              <Text size="1">Enabled: {trackInfo.enabled ? "✅" : "❌"}</Text>
              <Text size="1">Muted: {trackInfo.muted ? "❌" : "✅"}</Text>
              <Text size="1">Ready State: {trackInfo.readyState}</Text>
            </Flex>
          </Box>
        )}

        <Box>
          <Text size="2" weight="bold" style={{ color: "var(--gray-11)" }}>
            Troubleshooting Steps:
          </Text>
          <Flex direction="column" gap="1">
            <Text size="1">1. Check if audio element is paused/muted</Text>
            <Text size="1">2. Verify WebRTC connection is established</Text>
            <Text size="1">3. Check browser console for errors</Text>
            <Text size="1">4. Open WebRTC Internals to see RTP packets</Text>
            <Text size="1">5. Ensure user has interacted with the page</Text>
          </Flex>
        </Box>
      </Flex>
    </Card>
  );
}
