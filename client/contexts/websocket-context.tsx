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
  isRoomJoined: (chatId: string) => boolean;

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
    profile_id?: string;
  }) => void;
  emitGenerateScenario: (data: {
    scenario_id: string;
    field_values: Array<{
      fieldId: string;
      value: string;
      parameterId?: string;
      file?: File;
    }>;
    persona_ids?: string[];
    additional_prompt?: string;
    current_draft_objectives?: string[];
    generate_documents?: boolean;
  }) => void;
  emitUpdateScenarioParameters: (data: {
    scenario_id: string;
    field_values: Array<{
      fieldId: string;
      value: string;
      parameterId?: string;
      file?: File;
    }>;
    persona_ids?: string[];
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
  emitCreateTraining: (data: {
    name: string;
    description: string;
    document_id?: string;
    profile_id?: string;
  }) => void;

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
  const audioSenderPcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // message queue if data channel connecting
  const pendingText = useRef<string[]>([]);
  // queue for websocket fallback when socket is not connected yet
  const pendingSocketSendsRef = useRef<
    Array<{ chatId: string; message: string }>
  >([]);

  // remote audio element
  const { audioRef: audioPlaybackRef, getTrackState } = useRemoteAudio();

  // we still keep server-side per-chat text channels fallback
  const webRTCDataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  // confirmed rooms (server ack)
  const confirmedRoomsRef = useRef<Set<string>>(new Set());

  // ────────────────────────────────────────────────────────────────────────────
  // Socket lifecycle
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profileId) return;
    if (socketRef.current) return;

    const socket = io(getApiBase(), {
      path: "/socket.io",
      autoConnect: true,
      // Allow normal Socket.IO transport negotiation and upgrade
      transports: ["websocket"], // Start with polling, upgrade to websocket
      query: { profileId, timestamp: Date.now() },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      logInfo("WebSocket connected", { id: socket.id });
      // Rejoin any previously joined rooms after a reconnect
      try {
        currentRoomsRef.current.forEach((chatId) => {
          try {
            socket.emit("join_training", {
              chat_id: chatId,
              profile_id: profileId,
            });
          } catch {}
        });
      } catch {}
      // Flush any pending websocket sends now that we're connected
      try {
        while (pendingSocketSendsRef.current.length > 0) {
          const item = pendingSocketSendsRef.current.shift()!;
          socket.emit("send_training_message", {
            chat_id: item.chatId,
            message: item.message,
          });
        }
      } catch {}
    });

    socket.on("disconnect", (reason: string) => {
      setIsConnected(false);
      logInfo("WebSocket disconnected", { reason });
      cleanupRTC();
      confirmedRoomsRef.current.clear();
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
        document_ids: string[];
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
          // toast.success(data.message);
          confirmedRoomsRef.current.add(data.chat_id);
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

    // Word-level transcript events
    socket.on(
      "transcript",
      (ev: {
        room_id: string;
        agent_id: string;
        message_id?: string | null;
        start_ts_ms: number;
        text: string;
        words: { start_ms: number; end_ms: number; text: string }[];
      }) => {
        try {
          // Debug log to verify client reception
          logInfo("transcript (raw)", {
            messageId: ev.message_id,
            wordsLength: ev.words?.length ?? 0,
            start_ts_ms: ev.start_ts_ms,
            current_time: Date.now(),
            time_diff: Date.now() - ev.start_ts_ms,
          });
        } catch {}
        // Forward as a DOM event for chat components to consume and attach by message id
        window.dispatchEvent(
          new CustomEvent("agentTranscript", {
            detail: ev,
          })
        );
      }
    );

    socket.on(
      "transcript_stop",
      (ev: {
        room_id: string;
        agent_id: string;
        message_id?: string | null;
        stop_ts_ms: number;
      }) => {
        // Inform server that client has clamped this message at stop_ts_ms
        try {
          if (socketRef.current && ev.message_id) {
            socketRef.current.emit("client_interrupted", {
              chat_id: ev.room_id,
              message_id: ev.message_id,
              stop_ts_ms: ev.stop_ts_ms,
            });
          }
        } catch {}
        window.dispatchEvent(
          new CustomEvent("agentTranscriptStop", {
            detail: ev,
          })
        );
      }
    );

    // Bridge precise client correction to server
    const onClientStop = (e: Event) => {
      try {
        const d = (e as CustomEvent).detail as {
          chat_id: string;
          message_id: string;
          stop_ts_ms: number;
        };
        if (!d?.chat_id || !d?.message_id) return;
        socketRef.current?.emit("client_interrupted", d);
      } catch {}
    };
    window.addEventListener(
      "clientTranscriptStop",
      onClientStop as EventListener
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
        hints: unknown[];
        low_hints: string[];
        high_hints: string[];
        message_id: string; // ★ expect message_id
      }) => {
        logInfo("Hints generated", data);
        if (data.success) {
          // Combine low and high hints into a single array for display
          const combinedHints = [
            ...(data.low_hints || []),
            ...(data.high_hints || []),
          ];

          window.dispatchEvent(
            new CustomEvent("hintsGenerated", {
              detail: {
                chatId: data.chat_id,
                messageId: data.message_id, // ★ forward messageId
                hints: data.hints,
                lowHints: data.low_hints || [],
                highHints: data.high_hints || [],
                combinedHints: combinedHints,
              },
            })
          );
        } else {
          toast.error(data.message);
        }
      }
    );

    // Scenario generation progress events
    socket.on(
      "scenario_progress",
      (data: {
        type:
          | "start"
          | "scenario"
          | "objectives"
          | "persona_prompt"
          | "document";
        message: string;
        completed?: boolean;
        total_tools?: number;
        count?: number;
        persona_alias?: string;
        persona_name?: string;
        document_id?: string;
        filename?: string;
        parameter_name?: string;
      }) => {
        logInfo("Scenario progress update", data);
        window.dispatchEvent(
          new CustomEvent("scenarioProgress", {
            detail: data,
          })
        );
      }
    );

    // Training creation progress events
    socket.on(
      "training_creation_progress",
      (data: {
        type:
          | "generating_training"
          | "generating_scenario"
          | "generating_document";
        message: string;
        progress: number;
      }) => {
        logInfo("Training creation progress update", data);
        window.dispatchEvent(
          new CustomEvent("trainingCreationProgress", {
            detail: data,
          })
        );
      }
    );

    // Training creation completion
    socket.on(
      "training_creation_completed",
      (data: {
        success: boolean;
        training_id: string;
        scenario_id: string;
        message: string;
        progress: number;
      }) => {
        logInfo("Training creation completed", data);
        if (data.success) {
          toast.success(data.message);
          window.dispatchEvent(
            new CustomEvent("trainingCreationCompleted", {
              detail: data,
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
      // Audio will be unlocked on first user interaction (mic toggle or message send)
      // to comply with browser autoplay policy
    });

    return () => {
      try {
        socket.disconnect();
      } catch {}
      socketRef.current = null;
      setIsConnected(false);
      cleanupRTC();
      window.removeEventListener(
        "clientTranscriptStop",
        onClientStop as EventListener
      );
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
    audioSenderRef.current = null;
    audioSenderPcRef.current = null;
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
    // Try immediate play; if blocked by browser autoplay policy, expose a one-shot unlock
    el.play().catch((e) => logError("autoplay failed", e));
  };

  const ensureMicSender = async (): Promise<RTCRtpSender | null> => {
    const pc = pcRef.current;
    if (!pc) return null;

    // Reuse only if the sender belongs to the current PC instance
    if (audioSenderRef.current && audioSenderPcRef.current === pc) {
      return audioSenderRef.current;
    }

    // ensure we have a bidirectional audio m-line
    const tx = pc.addTransceiver("audio", { direction: "sendrecv" });
    audioSenderRef.current = tx.sender;
    audioSenderPcRef.current = pc;
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
      // If already connected to a different room, rebuild the PC bound to the new room
      if (isRTCConnected) {
        if (rtcRoomId === chatId) return;
        // Switch rooms: tear down and continue with fresh connection
        cleanupRTC();
        setIsRTCConnected(false);
      }
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
        try {
          // Ignore if PC changed or is already closed
          if (!pcRef.current || pcRef.current !== pc) return;
          if (pc.signalingState === "closed") {
            logInfo("Ignoring answer: PC already closed");
            return;
          }
          await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
          setIsRTCConnected(true);
          logInfo("RTC connected (answer set)");
        } catch (err) {
          logError("Failed to set remote description", err as Error);
        } finally {
          try {
            socket.off("answer", onAnswer);
          } catch {}
        }
      };
      // Remove any stale listeners before attaching a new handler
      try {
        socket.off("answer");
      } catch {}
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
    if (!pc || pc.signalingState === "closed") return; // not connected or closed

    // Try to unlock audio on first user interaction
    try {
      const el = audioPlaybackRef.current;
      if (el) {
        el.muted = false;
        await el.play();
      }
    } catch (error) {
      logError("Failed to unlock audio on mic toggle", error);
    }

    // ensure we have a sender
    const sender = await ensureMicSender();
    if (!sender) return;

    if (!micOn) {
      // turn ON
      const stream = await getMic();
      const track = stream.getAudioTracks()[0];
      try {
        if (pcRef.current && pcRef.current.signalingState !== "closed") {
          await sender.replaceTrack(track);
        }
      } catch (e) {
        logError("replaceTrack failed while turning mic ON", e as Error);
        return;
      }
      setMicOn(true);
      logInfo("Mic ON");
    } else {
      // turn OFF
      try {
        if (pcRef.current && pcRef.current.signalingState !== "closed") {
          await sender.replaceTrack(null);
        }
      } catch (e) {
        logError("replaceTrack failed while turning mic OFF", e as Error);
      }
      if (localStreamRef.current) {
        for (const t of localStreamRef.current.getTracks()) t.stop();
        localStreamRef.current = null;
      }
      setMicOn(false);
      logInfo("Mic OFF");
    }
  }, [micOn, getMic, audioPlaybackRef]);

  // Expose current local mic stream without creating a new one
  const getLocalMicStream = useCallback((): MediaStream | null => {
    return localStreamRef.current;
  }, []);

  // Enable voice mode - establishes RTC once and leaves it for page lifetime
  const enableVoiceMode = useCallback(
    async (chatId: string) => {
      if (!voiceMode) setVoiceMode(true);
      // Establish RTC only once; leave PC alive for page lifetime
      // Try to proactively unlock audio on a user gesture (click/keypress)
      try {
        const el = audioPlaybackRef.current;
        if (el) {
          el.muted = false;
          // best-effort; browsers may still block but user gesture context helps
          void el.play();
        }
      } catch {}

      if (!isRTCConnected || rtcRoomId !== chatId) {
        await connectRTC(chatId);
      }
    },
    [voiceMode, isRTCConnected, rtcRoomId, connectRTC, audioPlaybackRef]
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
      if (socketRef.current?.connected) {
        socketRef.current.emit("send_training_message", {
          chat_id: chatId,
          message,
        });
      } else {
        // queue until socket connects
        pendingSocketSendsRef.current.push({ chatId, message });
      }
    } catch (err) {
      logError("sendWebRTCMessage failed", err);
    }
  }, []);

  // Minimal room join/leave (unchanged semantics)
  const currentRoomsRef = useRef<Set<string>>(new Set());
  const joinRoom = useCallback(
    (chatId: string) => {
      // Track intent to be in this room regardless of connection state
      if (!currentRoomsRef.current.has(chatId)) {
        currentRoomsRef.current.add(chatId);
      }
      // If connected, emit immediately; otherwise connect handler will rejoin
      if (socketRef.current?.connected) {
        socketRef.current.emit("join_training", {
          chat_id: chatId,
          profile_id: profileId,
        });
      }
    },
    [profileId]
  );

  const leaveRoom = useCallback((chatId: string) => {
    if (!socketRef.current) return;
    if (!currentRoomsRef.current.has(chatId)) return;
    socketRef.current.emit("leave_training", { chat_id: chatId });
    currentRoomsRef.current.delete(chatId);
    confirmedRoomsRef.current.delete(chatId);
  }, []);

  const isRoomJoined = useCallback((chatId: string): boolean => {
    return confirmedRoomsRef.current.has(chatId);
  }, []);

  // Training event emitters (unchanged)
  const emitStartTraining = useCallback(
    (data: { scenario_id: string; profile_id?: string }) => {
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
      generate_documents?: boolean;
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

  const emitUpdateScenarioParameters = useCallback(
    (data: {
      scenario_id: string;
      field_values: Array<{
        fieldId: string;
        value: string;
        parameterId?: string;
        file?: File;
      }>;
      persona_ids?: string[];
    }) => {
      if (!socketRef.current?.connected) {
        logError("Cannot update scenario parameters - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }
      logInfo("Emitting update_scenario_parameters", {
        scenarioId: data.scenario_id,
      });
      socketRef.current.emit("update_scenario_parameters", data);
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

  const emitCreateTraining = useCallback(
    (data: {
      name: string;
      description: string;
      document_id?: string;
      profile_id?: string;
    }) => {
      if (!socketRef.current?.connected) {
        logError("Cannot create training - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }
      logInfo("Emitting create_training", data);
      socketRef.current.emit("create_training", data);
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
    isRoomJoined,
    sendWebRTCMessage,
    audioPlaybackRef,
    getTrackState,
    emitStartTraining,
    emitGenerateScenario,
    emitUpdateScenarioParameters,
    emitJoinTraining,
    emitSendTrainingMessage,
    emitSendIntroMessage,
    emitStopTraining,
    emitEndTraining,
    emitSubmitAssessment,
    emitGetHints,
    emitCreateTraining,
    getLocalMicStream,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {/* Hidden global audio element for server-mixed audio */}
      <audio
        ref={audioPlaybackRef}
        autoPlay
        playsInline
        muted={!isAudioBridgeReady ? true : false}
        style={{ display: "none" }}
      />
      {children}
    </WebSocketContext.Provider>
  );
}
