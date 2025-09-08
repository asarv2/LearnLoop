/**
 * Global WebSocket Context — refactored to own full WebRTC client-offer flow
 * - Calls rtc boot inside the context (roomId + iceServers, no messages)
 * - Small UI: just needs Connect + Mic buttons
 * - Keeps existing training events & fallbacks intact
 * - Preserves old sendWebRTCMessage() API while preferring the new data channel
 */
"use client";

import { useRemoteAudio } from "@/hooks/use-remote-audio";
import { getApiBase } from "@/lib/api/base";
import { toast } from "@/lib/toast";
import { logError, logInfo } from "@/utils/logger";
import { fetchRtcBoot, type RtcBoot } from "@/utils/rtc";
import { useRouter } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";

// ──────────────────────────────────────────────────────────────────────────────
// Context shape
// ──────────────────────────────────────────────────────────────────────────────
interface WebSocketContextType {
  // Socket
  isConnected: boolean;
  socket: Socket | null;

  // RTC
  rtcRoomId: string | null;
  isRTCConnected: boolean; // PeerConnection established (answer set)
  isAudioBridgeReady: boolean; // server ready to mix
  micOn: boolean; // local mic actively sending

  // Voice mode
  voiceMode: boolean; // NEW: single source of truth for voice mode
  enableVoiceMode: (chatId: string) => Promise<void>; // NEW: one-time RTC boot

  // UI helpers
  connectRTC: (chatId: string) => Promise<void>;
  disconnectRTC: () => void;
  toggleMic: () => Promise<void>;

  // Chat rooms (server-side training rooms)
  joinRoom: (chatId: string) => void;
  leaveRoom: (chatId: string) => void;

  // Text send – prefers RTC data channel; falls back to websocket emitter
  sendWebRTCMessage: (chatId: string, message: string) => void;

  // Expose the global audio element (remote mixed audio)
  audioPlaybackRef: React.RefObject<HTMLAudioElement | null>;

  // (legacy) diagnostics
  getTrackState: () => {
    id: string;
    kind: string;
    enabled: boolean;
    muted: boolean;
    readyState: string;
  } | null;

  // Training event emitters (unchanged)
  emitStartTraining: (data: {
    scenario_id: string;
    field_values: Array<{
      fieldId: string;
      value: string;
      parameterId?: string;
      file?: File;
    }>;
    profile_id?: string;
    scenario_draft?: {
      title: string;
      problem_statement: string;
      parent_id?: string;
      objectives?: string[];
    };
  }) => void;
  emitGenerateScenario: (data: {
    scenario_id: string;
    field_values: Array<{
      fieldId: string;
      value: string;
      parameterId?: string;
      file?: File;
    }>;
    additional_prompt?: string;
  }) => void;
  emitJoinTraining: (data: {
    attempt_id: string;
    training_id: string;
    chat_id: string;
    profile_id?: string;
  }) => void;
  emitSendTrainingMessage: (data: { chat_id: string; message: string }) => void;
  emitSendIntroMessage: (data: { chat_id: string; message: string }) => void;
  emitStopTraining: (data: { chat_id: string }) => void;
  emitEndTraining: (data: { chat_id: string }) => void;
  emitSubmitAssessment: (data: {
    chat_id: string;
    responses: Record<string, unknown>;
  }) => void;
  emitGetHints: (data: { chat_id: string; message_id: string }) => void;

  // Local mic stream access for UI visualizations (read-only)
  getLocalMicStream: () => MediaStream | null;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);
export const useWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx)
    throw new Error("useWebSocket must be used within WebSocketProvider");
  return ctx;
};

// ──────────────────────────────────────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────────────────────────────────────
interface WebSocketProviderProps {
  children: React.ReactNode;
  profileId?: string | undefined;
}

export function WebSocketProvider({
  children,
  profileId,
}: WebSocketProviderProps) {
  const router = useRouter();

  // Socket
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // RTC
  const [rtcRoomId, setRtcRoomId] = useState<string | null>(null);
  const [isRTCConnected, setIsRTCConnected] = useState(false);
  const [isAudioBridgeReady, setIsAudioBridgeReady] = useState(false);
  const [micOn, setMicOn] = useState(false);

  // Voice mode
  const [voiceMode, setVoiceMode] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const textChanRef = useRef<RTCDataChannel | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // message queue if data channel connecting
  const pendingText = useRef<string[]>([]);

  // remote audio element
  const { audioRef: audioPlaybackRef, getTrackState } = useRemoteAudio();

  // we still keep server-side per-chat text channels fallback
  const webRTCDataChannels = useRef<Map<string, RTCDataChannel>>(new Map());

  // ────────────────────────────────────────────────────────────────────────────
  // Socket lifecycle
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profileId) return;
    if (socketRef.current) return;

    const socket = io(getApiBase(), {
      path: "/socket.io",
      autoConnect: true,
      transports: ["websocket"],
      upgrade: false,
      query: { profileId, timestamp: Date.now(), EIO: "4" },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      logInfo("WebSocket connected", { id: socket.id });
    });

    socket.on("disconnect", (reason: string) => {
      setIsConnected(false);
      logInfo("WebSocket disconnected", { reason });
      cleanupRTC();
    });

    socket.on("connect_error", (err: Error) => {
      logError("WebSocket connect error", err.message);
      setIsConnected(false);
    });

    // Training / grading / hints events remain unchanged
    // Set up training event handlers
    socket.on(
      "training_started",
      (data: {
        success: boolean;
        message: string;
        attempt_id: string;
        chat_id: string;
        training_id: string;
      }) => {
        logInfo("Training started", data);
        if (data.success) {
          toast.success(data.message);

          // Complete the "Creating scenario" step in the progress bar
          // Dispatch event to notify NewScenario component to complete progress
          window.dispatchEvent(
            new CustomEvent("trainingStarted", {
              detail: {
                success: data.success,
                attemptId: data.attempt_id,
                trainingId: data.training_id,
              },
            })
          );

          // Add a delay before navigation to allow progress bar to complete
          setTimeout(() => {
            router.push(
              `/dashboard/trainings/t/${data.training_id}/a/${data.attempt_id}`
            );
          }, 750); // 0.75 second delay
        } else {
          toast.error(data.message);
        }
      }
    );

    // Scenario generation response
    socket.on(
      "scenario_generated",
      (data: {
        success: boolean;
        message?: string;
        scenario_id: string;
        title: string;
        problem_statement: string;
        objectives: string[];
      }) => {
        logInfo("Scenario generated", data);
        if (data.success) {
          window.dispatchEvent(
            new CustomEvent("scenarioGenerated", {
              detail: data,
            })
          );
        } else if (data.message) {
          toast.error(data.message);
        }
      }
    );

    socket.on(
      "training_joined",
      (data: { success: boolean; message: string; chat_id: string }) => {
        logInfo("Training joined", data);
        if (data.success) {
          toast.success(data.message);
        } else {
          toast.error(data.message);
        }
      }
    );

    socket.on(
      "user_message_saved",
      (data: { chat_id: string; message: Record<string, unknown> }) => {
        logInfo("Received user message confirmation", data);
        window.dispatchEvent(
          new CustomEvent("userMessageSaved", {
            detail: { chatId: data.chat_id, message: data.message },
          })
        );
      }
    );

    socket.on(
      "training_message_start",
      (data: { chat_id: string; message_id: string; persona_id: string }) => {
        logInfo("Training message start", data);
        window.dispatchEvent(
          new CustomEvent("trainingMessageStart", {
            detail: {
              chatId: data.chat_id,
              messageId: data.message_id,
              personaId: data.persona_id,
            },
          })
        );
      }
    );

    socket.on(
      "training_message_token",
      (data: {
        chat_id: string;
        message_id: string;
        token: string;
        accumulated_content: string;
      }) => {
        window.dispatchEvent(
          new CustomEvent("trainingMessageToken", {
            detail: {
              chatId: data.chat_id,
              messageId: data.message_id,
              token: data.token,
              accumulatedContent: data.accumulated_content,
            },
          })
        );
      }
    );

    socket.on(
      "training_message_complete",
      (data: {
        chat_id: string;
        message_id: string;
        final_content: string;
      }) => {
        logInfo("Training message complete", data);
        window.dispatchEvent(
          new CustomEvent("trainingMessageComplete", {
            detail: {
              chatId: data.chat_id,
              messageId: data.message_id,
              finalContent: data.final_content,
            },
          })
        );
      }
    );

    socket.on(
      "training_message_error",
      (data: { chat_id: string; message_id: string; error: string }) => {
        logError("Training message error", data.error);
        toast.error(data.error);
        window.dispatchEvent(
          new CustomEvent("trainingMessageError", {
            detail: {
              chatId: data.chat_id,
              messageId: data.message_id,
              error: data.error,
            },
          })
        );
      }
    );

    socket.on(
      "training_stopped",
      (data: { chat_id: string; success: boolean; message: string }) => {
        logInfo("Training stopped", data);
        if (data.success && data.message) {
          toast.success(data.message);
        } else {
          toast.error(data.message);
        }
      }
    );

    socket.on(
      "training_ended",
      (data: {
        success: boolean;
        message: string;
        chat_id: string;
        assessment_ready?: boolean;
        assessment_id?: string;
      }) => {
        logInfo("Training ended", data);
        if (data.success) {
          toast.success(data.message);
          window.dispatchEvent(
            new CustomEvent("trainingEnded", {
              detail: {
                chatId: data.chat_id,
                success: data.success,
                message: data.message,
                assessmentReady: data.assessment_ready || false,
                assessmentId: data.assessment_id,
              },
            })
          );
        } else {
          toast.error(data.message);
        }
      }
    );

    socket.on(
      "assessment_submitted",
      (data: { success: boolean; message: string; chat_id: string }) => {
        logInfo("Assessment submitted", data);
        if (data.success) {
          toast.success(data.message);
          window.dispatchEvent(
            new CustomEvent("assessmentSubmitted", {
              detail: {
                chatId: data.chat_id,
                success: data.success,
                message: data.message,
              },
            })
          );
        } else {
          toast.error(data.message);
        }
      }
    );

    socket.on(
      "grading_completed",
      (data: { chat_id: string; rubric_grade_id: string; message: string }) => {
        logInfo("Grading completed", data);
        window.dispatchEvent(
          new CustomEvent("gradingCompleted", {
            detail: {
              chatId: data.chat_id,
              rubricGradeId: data.rubric_grade_id,
              message: data.message,
            },
          })
        );
      }
    );

    socket.on(
      "assessment_completed",
      (data: {
        success: boolean;
        message: string;
        chat_id: string;
        assessment_id: string;
      }) => {
        logInfo("Assessment completed", data);
        if (data.success) {
          window.dispatchEvent(
            new CustomEvent("assessmentCompleted", {
              detail: {
                chatId: data.chat_id,
                success: data.success,
                message: data.message,
                assessmentId: data.assessment_id,
              },
            })
          );
        } else {
          toast.error(data.message);
        }
      }
    );

    socket.on(
      "hints_generated",
      (data: {
        success: boolean;
        message: string;
        chat_id: string;
        hints: string[];
        message_id: string; // ★ expect message_id
      }) => {
        logInfo("Hints generated", data);
        if (data.success) {
          window.dispatchEvent(
            new CustomEvent("hintsGenerated", {
              detail: {
                chatId: data.chat_id,
                messageId: data.message_id, // ★ forward messageId
                hints: data.hints,
              },
            })
          );
        } else {
          toast.error(data.message);
        }
      }
    );

    socket.on(
      "user_message_token",
      (data: {
        chat_id: string;
        message_id: string;
        token?: string;
        accumulated_content?: string;
      }) => {
        window.dispatchEvent(
          new CustomEvent("userMessageToken", {
            detail: {
              chatId: data.chat_id,
              messageId: data.message_id,
              token: data.token ?? "",
              accumulatedContent: data.accumulated_content ?? "",
            },
          })
        );
      }
    );

    socket.on(
      "user_message_complete",
      (data: {
        chat_id: string;
        message_id: string;
        final_content: string;
      }) => {
        window.dispatchEvent(
          new CustomEvent("userMessageComplete", {
            detail: {
              chatId: data.chat_id,
              messageId: data.message_id,
              finalContent: data.final_content,
            },
          })
        );
      }
    );

    socket.on(
      "conversation.item.input_audio_transcription.delta",
      (data: { chat_id: string; delta: string; itemId: string }) => {
        window.dispatchEvent(
          new CustomEvent("userTranscriptDelta", {
            detail: { chatId: data.chat_id, delta: data.delta },
          })
        );
      }
    );

    // Minimal extra listeners for RTC server notifications
    socket.on("webrtc_audio_ready", (d: { profile_id: string }) => {
      if (d.profile_id !== profileId) return;
      setIsAudioBridgeReady(true);
      logInfo("Server audio bridge ready");
    });

    return () => {
      try {
        socket.disconnect();
      } catch {}
      socketRef.current = null;
      setIsConnected(false);
      cleanupRTC();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, router]);

  // ────────────────────────────────────────────────────────────────────────────
  // RTC helpers
  // ────────────────────────────────────────────────────────────────────────────
  const cleanupRTC = useCallback(() => {
    // stop local mic
    if (localStreamRef.current) {
      for (const t of localStreamRef.current.getTracks()) t.stop();
      localStreamRef.current = null;
    }
    setMicOn(false);

    // close data channels
    try {
      textChanRef.current?.close();
    } catch {}
    textChanRef.current = null;
    webRTCDataChannels.current.forEach((c) => {
      try {
        c.close();
      } catch {}
    });
    webRTCDataChannels.current.clear();

    // close pc
    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;

    setIsRTCConnected(false);
    setIsAudioBridgeReady(false);

    // detach audio element
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.srcObject = null;
      try {
        audioPlaybackRef.current.pause();
      } catch {}
    }
  }, [audioPlaybackRef]);

  const attachRemoteAudio = (stream: MediaStream) => {
    const el = audioPlaybackRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.muted = false;
    el.play().catch((e) => logError("autoplay failed", e));
  };

  const ensureMicSender = async (): Promise<RTCRtpSender | null> => {
    const pc = pcRef.current;
    if (!pc) return null;

    if (audioSenderRef.current) return audioSenderRef.current;

    // ensure we have a bidirectional audio m-line
    const tx = pc.addTransceiver("audio", { direction: "sendrecv" });
    audioSenderRef.current = tx.sender;
    return audioSenderRef.current;
  };

  const getMic = useCallback(async (): Promise<MediaStream> => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 48000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    localStreamRef.current = stream;
    return stream;
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────────────
  const connectRTC = useCallback(
    async (chatId: string) => {
      if (isRTCConnected) return;
      if (!socketRef.current) {
        toast.error("Not connected to server");
        return;
      }

      // 1) Get ICE servers only
      let boot: RtcBoot;
      try {
        boot = await fetchRtcBoot();
        setRtcRoomId(chatId);
        logInfo("RTC boot", { roomId: chatId });
      } catch (e) {
        logError("rtc boot failed", e);
        toast.error("Failed to get RTC boot info");
        return;
      }

      // 2) Create PC and handlers
      const pc = new RTCPeerConnection({ iceServers: boot.iceServers });
      pcRef.current = pc;

      // Data channel for new text path (single, room-scoped)
      const dc = pc.createDataChannel("text");
      textChanRef.current = dc;
      dc.onopen = () => {
        logInfo("RTC text channel open");
        // flush queued
        while (pendingText.current.length && dc.readyState === "open") {
          dc.send(pendingText.current.shift()!);
        }
      };
      dc.onclose = () => logInfo("RTC text channel closed");
      dc.onerror = (e) => logError("RTC text channel error", e);

      // Ensure audio m-line exists
      await ensureMicSender();

      pc.ontrack = (e) => {
        const stream = e.streams[0];
        if (stream) attachRemoteAudio(stream);
      };

      pc.onicecandidate = (e) => {
        socketRef.current!.emit("ice_candidate", {
          candidate: e.candidate
            ? {
                candidate: e.candidate.candidate,
                sdpMid: e.candidate.sdpMid,
                sdpMLineIndex: e.candidate.sdpMLineIndex,
              }
            : null,
        });
      };

      // 3) Wire signaling: answer + send offer with room_id
      const socket = socketRef.current;
      const onAnswer = async (msg: { sdp: string }) => {
        await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
        setIsRTCConnected(true);
        logInfo("RTC connected (answer set)");
      };
      socket.on("answer", onAnswer);

      // if socket already connected, issue offer now; otherwise on connect
      const issueOffer = async () => {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);
        socket.emit("offer", {
          type: "offer",
          sdp: offer.sdp,
          room_id: chatId,
        });
      };

      if (socket.connected) {
        await issueOffer();
      } else {
        const onceConnect = async () => {
          socket.off("connect", onceConnect);
          await issueOffer();
        };
        socket.on("connect", onceConnect);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isRTCConnected]
  );

  const disconnectRTC = useCallback(() => {
    cleanupRTC();
    setRtcRoomId(null);
  }, [cleanupRTC]);

  const toggleMic = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return; // not connected yet

    // ensure we have a sender
    const sender = await ensureMicSender();
    if (!sender) return;

    if (!micOn) {
      // turn ON
      const stream = await getMic();
      const track = stream.getAudioTracks()[0];
      await sender.replaceTrack(track);
      setMicOn(true);
      logInfo("Mic ON");
    } else {
      // turn OFF
      await sender.replaceTrack(null);
      if (localStreamRef.current) {
        for (const t of localStreamRef.current.getTracks()) t.stop();
        localStreamRef.current = null;
      }
      setMicOn(false);
      logInfo("Mic OFF");
    }
  }, [micOn, getMic]);

  // Expose current local mic stream without creating a new one
  const getLocalMicStream = useCallback((): MediaStream | null => {
    return localStreamRef.current;
  }, []);

  // Enable voice mode - establishes RTC once and leaves it for page lifetime
  const enableVoiceMode = useCallback(
    async (chatId: string) => {
      if (!voiceMode) setVoiceMode(true);
      // Establish RTC only once; leave PC alive for page lifetime
      if (!isRTCConnected) {
        await connectRTC(chatId);
      }
    },
    [voiceMode, isRTCConnected, connectRTC]
  );

  // Prefer new single text channel; fallback to legacy per-chat channel or websocket emitter
  const sendWebRTCMessage = useCallback((chatId: string, message: string) => {
    try {
      const payloadNew = JSON.stringify({
        text: message,
        chunk_idx: 0,
        is_final: true,
        chat_id: chatId,
      });

      // 1) New room text channel
      if (textChanRef.current && textChanRef.current.readyState === "open") {
        textChanRef.current.send(payloadNew);
        return;
      }
      if (
        textChanRef.current &&
        textChanRef.current.readyState === "connecting"
      ) {
        pendingText.current.push(payloadNew);
        return;
      }

      // 2) Legacy per-chat RTC channel (if you still spin these up elsewhere)
      const label = `text-${chatId}`;
      const legacy = webRTCDataChannels.current.get(label);
      if (legacy && legacy.readyState === "open") {
        legacy.send(JSON.stringify({ chat_id: chatId, content: message }));
        return;
      }

      // 3) Fallback to websocket emitter used by server
      socketRef.current?.emit("send_training_message", {
        chat_id: chatId,
        message,
      });
    } catch (err) {
      logError("sendWebRTCMessage failed", err);
    }
  }, []);

  // Minimal room join/leave (unchanged semantics)
  const currentRoomsRef = useRef<Set<string>>(new Set());
  const joinRoom = useCallback(
    (chatId: string) => {
      if (!socketRef.current?.connected) return;
      if (currentRoomsRef.current.has(chatId)) return;
      socketRef.current.emit("join_training", {
        chat_id: chatId,
        profile_id: profileId,
      });
      currentRoomsRef.current.add(chatId);
    },
    [profileId]
  );

  const leaveRoom = useCallback((chatId: string) => {
    if (!socketRef.current) return;
    if (!currentRoomsRef.current.has(chatId)) return;
    socketRef.current.emit("leave_training", { chat_id: chatId });
    currentRoomsRef.current.delete(chatId);
  }, []);

  // Training event emitters (unchanged)
  const emitStartTraining = useCallback(
    (data: {
      scenario_id: string;
      field_values: Array<{
        fieldId: string;
        value: string;
        parameterId?: string;
        file?: File;
      }>;
      profile_id?: string;
    }) => {
      if (!socketRef.current?.connected) {
        logError("Cannot start training - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }
      logInfo("Emitting start_training", data);
      socketRef.current.emit("start_training", data);
    },
    []
  );

  const emitGenerateScenario = useCallback(
    (data: {
      scenario_id: string;
      field_values: Array<{
        fieldId: string;
        value: string;
        parameterId?: string;
        file?: File;
      }>;
      additional_prompt?: string;
    }) => {
      if (!socketRef.current?.connected) {
        logError("Cannot generate scenario - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }
      logInfo("Emitting generate_scenario", { scenarioId: data.scenario_id });
      socketRef.current.emit("generate_scenario", data);
    },
    []
  );

  const emitJoinTraining = useCallback(
    (data: {
      attempt_id: string;
      training_id: string;
      chat_id: string;
      profile_id?: string;
    }) => {
      if (!socketRef.current?.connected) {
        logError("Cannot join training - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }
      router.push(
        `/dashboard/trainings/t/${data.training_id}/a/${data.attempt_id}`
      );
      logInfo("Emitting join_training", data);
      socketRef.current.emit("join_training", data);
    },
    [router]
  );

  const emitSendTrainingMessage = useCallback(
    (data: { chat_id: string; message: string }) => {
      if (!socketRef.current?.connected) {
        logError("Cannot send training message - WebSocket not connected");
        return;
      }
      logInfo("Emitting send_training_message", { chatId: data.chat_id });
      socketRef.current.emit("send_training_message", data);
    },
    []
  );

  const emitSendIntroMessage = useCallback(
    async (data: { chat_id: string; message: string }) => {
      try {
        if (!socketRef.current?.connected) {
          logError("Cannot send message - WebSocket not connected");
          toast.error("WebSocket not connected. Please refresh the page.");
          return;
        }

        // Ensure we're joined and RTC/voice path is ready (like Training page)
        try {
          joinRoom(data.chat_id);
        } catch {}

        try {
          await enableVoiceMode(data.chat_id);
        } catch (e) {
          logError("Failed to enable voice mode for intro message", e as Error);
        }

        // Route via the normal message path (RTC DC preferred, websocket fallback)
        sendWebRTCMessage(data.chat_id, data.message);
      } catch (err) {
        logError("emitSendIntroMessage failed", err as Error);
      }
    },
    [enableVoiceMode, joinRoom, sendWebRTCMessage]
  );

  const emitStopTraining = useCallback((data: { chat_id: string }) => {
    if (!socketRef.current?.connected) {
      logError("Cannot stop training - WebSocket not connected");
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }
    logInfo("Emitting stop_training", data);
    socketRef.current.emit("stop_training", data);
  }, []);

  const emitEndTraining = useCallback((data: { chat_id: string }) => {
    if (!socketRef.current?.connected) {
      logError("Cannot end training - WebSocket not connected");
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }
    logInfo("Emitting end_training", data);
    socketRef.current.emit("end_training", data);
  }, []);

  const emitSubmitAssessment = useCallback(
    (data: { chat_id: string; responses: Record<string, unknown> }) => {
      if (!socketRef.current?.connected) {
        logError("Cannot submit assessment - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }
      logInfo("Emitting submit_assessment", data);
      socketRef.current.emit("submit_assessment", data);
    },
    []
  );

  const emitGetHints = useCallback(
    (data: { chat_id: string; message_id: string }) => {
      if (!socketRef.current?.connected) {
        logError("Cannot get hints - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }
      logInfo("Emitting get_hints", data);
      socketRef.current.emit("get_hints", data);
    },
    []
  );

  // ────────────────────────────────────────────────────────────────────────────
  // Value
  // ────────────────────────────────────────────────────────────────────────────
  const value: WebSocketContextType = {
    isConnected,
    socket: socketRef.current,
    rtcRoomId,
    isRTCConnected,
    isAudioBridgeReady,
    micOn,
    voiceMode,
    enableVoiceMode,
    connectRTC,
    disconnectRTC,
    toggleMic,
    joinRoom,
    leaveRoom,
    sendWebRTCMessage,
    audioPlaybackRef,
    getTrackState,
    emitStartTraining,
    emitGenerateScenario,
    emitJoinTraining,
    emitSendTrainingMessage,
    emitSendIntroMessage,
    emitStopTraining,
    emitEndTraining,
    emitSubmitAssessment,
    emitGetHints,
    getLocalMicStream,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {/* Hidden global audio element for server-mixed audio */}
      <audio
        ref={audioPlaybackRef}
        autoPlay
        playsInline
        muted={true}
        style={{ display: "none" }}
      />
      {children}
    </WebSocketContext.Provider>
  );
}
