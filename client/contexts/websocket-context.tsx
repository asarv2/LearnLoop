/**
 * Global WebSocket Context for managing a single WebSocket connection
 * This provides a centralized way to manage WebSocket connections and events
 * across all components based on the user's profile ID
 */
"use client";

import { useRemoteAudio } from "@/hooks/use-remote-audio";
import { getApiBase } from "@/lib/api/base";
import { toast } from "@/lib/toast";
import { logError, logInfo } from "@/utils/logger";
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

interface WebSocketContextType {
  // Connection state
  isConnected: boolean;
  socket: Socket | null;

  // WebRTC state
  isWebRTCConnected: boolean;
  isAudioBridgeReady: boolean; // ✨ Add this new state

  // Loading states for debugging
  isStartingTraining: boolean;
  isSendingTrainingMessage: boolean;
  isStoppingTraining: boolean;
  isEndingTraining: boolean;
  isSubmittingAssessment: boolean;
  isGettingHints: boolean; // ✨ Add hints loading state

  // Room management (chat_id-based)
  joinRoom: (chatId: string) => void; // should create webRTC data channel (for text) and optionally media channel (for audio)
  leaveRoom: (chatId: string) => void; // should close webRTC data channel (for text) and optionally media channel (for audio)

  // WebRTC Emitters
  sendWebRTCMessage: (chatId: string, message: string) => void;

  // ✨ NEW: Refactored audio functions for persistent streams
  initializeAudioStream: (chatId: string) => Promise<void>;
  setMicrophoneMuted: (muted: boolean) => void;
  terminateAudioStream: (chatId: string) => void;
  audioPlaybackRef: React.RefObject<HTMLAudioElement | null>; // 👈 ADD THIS LINE
  getTrackState: () => {
    id: string;
    kind: string;
    enabled: boolean;
    muted: boolean;
    readyState: string;
  } | null; // Remote track state
  getLocalMicTrackState: () => {
    id: string;
    kind: string;
    enabled: boolean;
    muted: boolean;
    readyState: string;
  } | null; // Local microphone track state
  enableServerAudio: () => void; // Enable server audio playback
  disableServerAudio: () => void; // Disable server audio playback
  triggerServerAudio: () => void; // Trigger server audio by sending silent frame

  // Training event emitters
  emitStartTraining: (data: {
    scenario_id: string;
    field_values: Array<{
      fieldId: string;
      value: string;
      parameterId?: string;
      file?: File;
    }>;
    profile_id?: string;
  }) => void;
  emitJoinTraining: (data: {
    attempt_id: string;
    training_id: string;
    chat_id: string;
    profile_id?: string;
  }) => void;
  emitSendTrainingMessage: (data: { chat_id: string; message: string }) => void;
  emitStopTraining: (data: { chat_id: string }) => void;
  emitEndTraining: (data: { chat_id: string }) => void;
  emitSubmitAssessment: (data: {
    chat_id: string;
    responses: Record<string, unknown>;
  }) => void;
  emitGetHints: (data: { chat_id: string; message_id: string }) => void; // ✨ Add hints emitter
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
};

interface WebSocketProviderProps {
  children: React.ReactNode;
  profileId?: string | undefined;
}

export function WebSocketProvider({
  children,
  profileId,
}: WebSocketProviderProps) {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const connectionAttempts = useRef(0);
  const maxConnectionAttempts = 5;
  const currentRoomsRef = useRef<Set<string>>(new Set());

  // Loading states for debugging
  const [isStartingTraining, setIsStartingTraining] = useState(false);
  const [isSendingTrainingMessage, setIsSendingTrainingMessage] =
    useState(false);
  const [isStoppingTraining, setIsStoppingTraining] = useState(false);
  const [isEndingTraining, setIsEndingTraining] = useState(false);
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [isGettingHints, setIsGettingHints] = useState(false); // ✨ Add hints loading state

  // WebRTC state
  const [isWebRTCConnected, setIsWebRTCConnected] = useState(false);
  const [isAudioBridgeReady, setIsAudioBridgeReady] = useState(false); // ✨ Add state
  const webRTCPeerConnection = useRef<RTCPeerConnection | null>(null);
  const webRTCDataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const userMediaStream = useRef<MediaStream | null>(null);
  const audioTrackSenders = useRef<Map<string, RTCRtpSender>>(new Map());

  // ✨ NEW: Persistent audio track reference for mute/unmute
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);

  // ✨ NEW: Use the remote audio hook for better audio handling
  const {
    audioRef: audioPlaybackRef,
    playTrack,
    getTrackState,
    enableServerAudio,
    disableServerAudio,
  } = useRemoteAudio();

  // ✨ NEW: State to hold the incoming remote stream for reliable connection
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Message queues for data channels (text messages)
  const messageQueues = useRef<Map<string, string[]>>(new Map());

  // ICE candidate buffer for handling candidates before remote description is set
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);

  // Flag to prevent multiple webrtc_start emissions on reconnects
  const webrtcStarted = useRef(false);

  // ✅ FIX: Create a centralized cleanup function
  const cleanupWebRTC = useCallback(() => {
    if (webRTCPeerConnection.current) {
      // Close all data channels and event listeners
      webRTCPeerConnection.current.ontrack = null;
      webRTCPeerConnection.current.onicecandidate = null;
      webRTCPeerConnection.current.onconnectionstatechange = null;
      webRTCPeerConnection.current.close();
      webRTCPeerConnection.current = null;
    }

    // Clean up audio tracks
    if (userMediaStream.current) {
      userMediaStream.current.getTracks().forEach((track) => track.stop());
      userMediaStream.current = null;
    }
    audioTrackRef.current = null;
    audioTrackSenders.current.clear();

    // Clean up audio element
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.srcObject = null;
      audioPlaybackRef.current.pause();
    }

    setRemoteStream(null);
    setIsWebRTCConnected(false);
    setIsAudioBridgeReady(false); // ✨ Reset on cleanup
    webRTCDataChannels.current.clear();
    pendingIce.current = [];
    webrtcStarted.current = false; // Allow handshake on the next connection
    logInfo("WebRTC connection resources cleaned up.");
  }, [audioPlaybackRef]);

  // ✅ STEP 1: Create a new, centralized function to handle offers.
  const handleOffer = useCallback(
    async (data: {
      offer: RTCSessionDescriptionInit;
      ice_config: RTCIceServer[];
    }) => {
      let pc = webRTCPeerConnection.current;
      const socket = socketRef.current;

      if (!socket || !profileId) {
        logError("Cannot handle offer: socket or profileId not available.");
        return;
      }

      // Clean up if the connection is stale/closed
      if (pc && pc.signalingState === "closed") {
        logInfo("Ignoring offer for closed peer connection, cleaning up.");
        cleanupWebRTC();
        pc = null;
      }

      // This block only runs on the very first offer
      if (!pc) {
        logInfo("Creating new PeerConnection for initial setup.");
        pc = new RTCPeerConnection({ iceServers: data.ice_config });
        webRTCPeerConnection.current = pc;

        // Attach all event listeners ONCE during initial creation
        pc.onicecandidate = (event) => {
          if (socket.connected && event.candidate) {
            socket.emit("webrtc_ice_candidate", {
              profile_id: profileId,
              candidate: event.candidate,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          const currentState = webRTCPeerConnection.current?.connectionState;
          if (currentState) {
            setIsWebRTCConnected(currentState === "connected");
            logInfo(`WebRTC connection state: ${currentState}`);
          }
        };

        pc.ontrack = (event) => {
          logInfo("Received remote audio track from server", {
            streamId: event.streams[0]?.id,
            trackKind: event.track.kind,
            readyState: event.track.readyState,
          });
          if (event.track.kind === "audio" && event.streams[0]) {
            const remoteAudioStream = event.streams[0];

            // --- START OF THE FIX ---
            // 1. Attach the stream directly to the audio element to bypass React state latency.
            if (audioPlaybackRef.current) {
              logInfo(
                "Attaching stream directly to audio element in ontrack handler."
              );
              audioPlaybackRef.current.srcObject = remoteAudioStream;
            } else {
              logError(
                "Audio playback ref not available at the time of track event."
              );
            }
            // --- END OF THE FIX ---

            // 2. Still update the state for other components that might need it.
            setRemoteStream(remoteAudioStream);
          }
        };

        pc.ondatachannel = (event) => {
          const channel = event.channel;
          logInfo(`Received data channel from server: ${channel.label}`);
          webRTCDataChannels.current.set(channel.label, channel);
          channel.onopen = () =>
            logInfo(`Server data channel opened: ${channel.label}`);
          channel.onclose = () => {
            logInfo(`Server data channel closed: ${channel.label}`);
            webRTCDataChannels.current.delete(channel.label);
          };
          channel.onerror = (error) =>
            logError(`Server data channel error for ${channel.label}:`, error);
        };
      }

      // This logic runs for EVERY offer (initial + renegotiation)
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

      // Flush any pending ICE candidates
      pendingIce.current.forEach((candidate) => {
        pc.addIceCandidate(candidate).catch((e) =>
          logError("Error adding pending ICE", e)
        );
      });
      pendingIce.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("webrtc_answer", {
        profile_id: profileId,
        answer: { sdp: answer.sdp, type: answer.type },
      });
      logInfo("Sent WebRTC answer in response to offer.");
    },
    [profileId, cleanupWebRTC, audioPlaybackRef] // Add dependencies
  );

  // ✨ NEW: Effect to reliably connect the remote stream to the audio element
  useEffect(() => {
    const audioEl = audioPlaybackRef.current;
    if (audioEl && remoteStream) {
      logInfo("Attaching remote stream to audio element", {
        streamId: remoteStream.id,
        trackCount: remoteStream.getTracks().length,
      });

      // Create a new MediaStream with just the audio track for cleaner handling
      const audioTracks = remoteStream.getAudioTracks();
      if (audioTracks.length > 0) {
        // ✅ Explicitly enable each track to ensure it's not muted by default
        audioTracks.forEach((track) => {
          track.enabled = true;
          logInfo("Enabled audio track", {
            trackId: track.id,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
          });
        });

        const audioOnlyStream = new MediaStream(audioTracks);
        audioEl.srcObject = audioOnlyStream;

        // ❌ REMOVE THE PLAY CALL FROM HERE!
        // The browser will block this and cause the error.
        // audioEl.play().catch((error) => {
        //   logError("Audio element autoplay failed", error);
        // });
      }
    }
  }, [remoteStream, audioPlaybackRef]);

  // ✨ NEW: Cleanup effect to reset remote stream when WebRTC connection changes
  useEffect(() => {
    if (!isWebRTCConnected) {
      setRemoteStream(null);
      logInfo("WebRTC disconnected, clearing remote stream state");
    }
  }, [isWebRTCConnected]);

  // Create data channels for text messaging and process queued messages when they open
  const createDataChannelIfNeeded = useCallback(
    (channelLabel: string): RTCDataChannel | undefined => {
      const pc = webRTCPeerConnection.current;
      if (!pc) {
        logError("Cannot create data channel, PeerConnection is null.");
        return undefined;
      }
      if (pc.connectionState === "closed" || pc.connectionState === "failed") {
        logError(
          `Cannot create data channel, PeerConnection is in state: ${pc.connectionState}`
        );
        return undefined;
      }

      let channel = webRTCDataChannels.current.get(channelLabel);
      if (!channel || channel.readyState === "closed") {
        channel = pc.createDataChannel(channelLabel, { ordered: true });
        logInfo(`Created WebRTC data channel: ${channelLabel}`);

        channel.onopen = () => {
          logInfo(`WebRTC data channel opened: ${channelLabel}`);
          const queue = messageQueues.current.get(channelLabel);
          if (queue && queue.length > 0) {
            logInfo(
              `Draining ${queue.length} queued messages for ${channelLabel}`
            );
            queue.forEach((msg) => {
              if (channel && channel.readyState === "open") {
                channel.send(msg);
              }
            });
            messageQueues.current.delete(channelLabel);
          }
        };

        channel.onclose = () => {
          logInfo(`WebRTC data channel closed: ${channelLabel}`);
          webRTCDataChannels.current.delete(channelLabel);
          messageQueues.current.delete(channelLabel);
        };

        channel.onerror = (error) => {
          logError(`WebRTC data channel error for ${channelLabel}`, error);
        };

        webRTCDataChannels.current.set(channelLabel, channel);
      }
      return channel;
    },
    []
  );

  // Initialize WebSocket connection when profileId is available
  useEffect(() => {
    if (!profileId) {
      logInfo("Waiting for profile ID before connecting WebSocket", {
        profileId,
      });
      return;
    }

    if (socketRef.current?.connected) {
      logInfo("WebSocket already connected, skipping initialization", {
        profileId,
      });
      return;
    }

    // Prevent multiple connection attempts
    if (socketRef.current) {
      logInfo("WebSocket connection in progress, skipping initialization", {
        profileId,
      });
      return;
    }

    const roomsToCleanup = currentRoomsRef.current;

    const connectWebSocket = async () => {
      logInfo("Initializing global WebSocket connection", {
        profileId,
        attempt: connectionAttempts.current + 1,
      });
      const socket = io(getApiBase(), {
        path: "/socket.io",
        autoConnect: true,
        timeout: 30000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 8000,
        transports: ["websocket"],
        upgrade: false,
        rememberUpgrade: true,
        query: {
          profileId,
          timestamp: Date.now(),
          EIO: "4",
        },
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        connectionAttempts.current = 0;
        logInfo("Global WebSocket connected successfully", {
          socketId: socket.id,
          profileId,
          transport: socket.io.engine.transport.name,
        });

        // Kick-off WebRTC handshake once the socket is up
        if (!webrtcStarted.current && !webRTCPeerConnection.current) {
          socket.emit("webrtc_start", { profile_id: profileId });
          webrtcStarted.current = true;
          logInfo("Sent webrtc_start");
        }
      });

      socket.on("disconnect", (reason: string) => {
        setIsConnected(false);
        logInfo(`Global WebSocket disconnected: ${reason}`, {
          socketId: socket.id,
          profileId,
        });
        cleanupWebRTC(); // ✅ FIX: Clean up WebRTC on disconnect
      });

      socket.on("connect_error", (error: Error) => {
        connectionAttempts.current++;
        logError("Global WebSocket connection error:", error.message, {
          attempt: connectionAttempts.current,
          maxAttempts: maxConnectionAttempts,
          profileId,
          errorType: error.name,
          errorStack: error.stack,
          fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
        setIsConnected(false);

        if (connectionAttempts.current >= maxConnectionAttempts) {
          toast.error(
            "Unable to connect to real-time updates. Some features may be limited."
          );
        }
      });

      socket.on("reconnect", (attemptNumber: number) => {
        setIsConnected(true);
        logInfo("Global WebSocket reconnected", {
          socketId: socket.id,
          profileId,
          attemptNumber,
        });
        toast.success("Connection restored!");
      });

      socket.on("reconnect_failed", () => {
        setIsConnected(false);
        logError("Global WebSocket reconnection failed permanently", {
          profileId,
        });
        toast.error("Connection lost. Please refresh the page to reconnect.");
      });

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
          setIsStartingTraining(false);
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

      socket.on(
        "training_joined",
        (data: { success: boolean; message: string; chat_id: string }) => {
          logInfo("Training joined", data);
          setIsStartingTraining(false);
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
              detail: {
                chatId: data.chat_id,
                message: data.message, // This now contains persona_id
              },
            })
          );
        }
      );

      socket.on(
        "training_message_start",
        // ✨ Add persona_id to the expected data structure
        (data: { chat_id: string; message_id: string; persona_id: string }) => {
          logInfo("Training message start", data);
          setIsSendingTrainingMessage(false);

          // Dispatch event for UI components to listen to
          window.dispatchEvent(
            new CustomEvent("trainingMessageStart", {
              detail: {
                chatId: data.chat_id,
                messageId: data.message_id,
                personaId: data.persona_id, // ✨ Pass it along
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
          // Dispatch event with streaming data for real-time UI updates
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
          setIsSendingTrainingMessage(false);

          // Dispatch event for UI components to handle completion
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

      // ✅ NEW: Handle server VAD events
      socket.on(
        "server_vad_event",
        (data: { type: string; chat_id: string; profile_id: string }) => {
          logInfo("Server VAD event received", data);
          window.dispatchEvent(
            new CustomEvent("server_vad_event", {
              detail: data,
            })
          );
        }
      );

      // ✅ NEW: Handle audio interruption events
      socket.on(
        "audio_interrupted",
        (data: { chat_id: string; profile_id: string }) => {
          logInfo("Audio interrupted event received", data);
          window.dispatchEvent(
            new CustomEvent("audio_interrupted", {
              detail: data,
            })
          );
        }
      );

      socket.on(
        "training_message_error",
        (data: { chat_id: string; message_id: string; error: string }) => {
          logError("Training message error", data.error);
          setIsSendingTrainingMessage(false);
          toast.error(data.error);

          // Dispatch event for UI components to handle errors
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
          setIsStoppingTraining(false);
          if (data.success) {
            if (data.message) {
              toast.success(data.message);
            }
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
          setIsEndingTraining(false);
          if (data.success) {
            toast.success(data.message);

            // Dispatch event for UI components to handle training completion
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
          setIsSubmittingAssessment(false);
          if (data.success) {
            toast.success(data.message);

            // Dispatch event for UI components to handle assessment completion
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

      // ✅ NEW: Handle grading completion event
      socket.on(
        "grading_completed",
        (data: {
          chat_id: string;
          rubric_grade_id: string;
          message: string;
        }) => {
          logInfo("Grading completed", data);

          // Dispatch event for UI components to handle grading completion
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

      // ✅ NEW: Handle assessment completion event (when all 7 questions are ready)
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
            // Dispatch event for UI components to handle assessment completion
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
        }) => {
          logInfo("Hints generated", data);
          setIsGettingHints(false);
          if (data.success) {
            // Dispatch event for UI components to handle hints
            window.dispatchEvent(
              new CustomEvent("hintsGenerated", {
                detail: {
                  chatId: data.chat_id,
                  hints: data.hints,
                },
              })
            );
          } else {
            toast.error(data.message);
          }
        }
      );

      // ✅ FIX: Listen for user's own transcription deltas
      socket.on(
        "conversation.item.input_audio_transcription.delta",
        (data: { chat_id: string; delta: string; itemId: string }) => {
          window.dispatchEvent(
            new CustomEvent("userTranscriptDelta", {
              detail: {
                chatId: data.chat_id,
                delta: data.delta,
              },
            })
          );
        }
      );

      // WebRTC event handlers
      socket.on(
        "webrtc_offer",
        (data: {
          profile_id: string;
          offer: RTCSessionDescriptionInit;
          ice_config: RTCIceServer[];
        }) => {
          if (data.profile_id === profileId) {
            logInfo("Received WebRTC offer from server.");
            handleOffer(data).catch((error) => {
              logError("Error in handleOffer", error);
            });
          }
        }
      );

      socket.on(
        "webrtc_ice_candidate",
        async (data: {
          profile_id: string;
          candidate: {
            candidate: string;
            sdpMid?: string;
            sdpMLineIndex?: number;
          };
        }) => {
          try {
            const pc = webRTCPeerConnection.current;
            if (!pc || !data.candidate) return;

            if (!pc.remoteDescription) {
              logInfo(
                "Buffering ICE candidate - remote description not set yet"
              );
              pendingIce.current.push(data.candidate);
              return;
            }

            const iceCandidate = new RTCIceCandidate(data.candidate);
            await pc.addIceCandidate(iceCandidate);
            logInfo("Added WebRTC ICE candidate");
          } catch (error) {
            logError("Error adding ICE candidate", error);
          }
        }
      );

      socket.on("webrtc_ready", (data: { profile_id: string }) => {
        logInfo("WebRTC connection ready", { profileId: data.profile_id });
        setIsWebRTCConnected(true);

        // Create per-chat channels that were queued while connecting
        currentRoomsRef.current.forEach((roomId) => {
          createDataChannelIfNeeded(`text-${roomId}`);
        });
      });

      // ✨ Add the new event listener
      socket.on("webrtc_audio_ready", (data: { profile_id: string }) => {
        if (data.profile_id === profileId) {
          logInfo("Server audio bridge is ready.");
          setIsAudioBridgeReady(true);
        }
      });

      socket.on("webrtc_error", (data: { error: string }) => {
        logError("WebRTC error", data.error);
        toast.error(`WebRTC error: ${data.error}`);
        setIsWebRTCConnected(false);
      });
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        logInfo("Cleaning up global WebSocket connection");
        roomsToCleanup.forEach((roomId) => {
          socketRef.current?.emit("leave_chat", {
            chat_id: roomId,
            chat_type: "any",
          });
        });
        roomsToCleanup.clear();

        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        cleanupWebRTC(); // ✅ FIX: Clean up WebRTC on component unmount
      }
    };
  }, [
    profileId,
    createDataChannelIfNeeded,
    playTrack,
    audioPlaybackRef,
    cleanupWebRTC,
    handleOffer,
    router,
  ]);

  // Room management (chat_id-based)
  const joinRoom = useCallback(
    (chatId: string) => {
      if (!socketRef.current?.connected) {
        logInfo("Cannot join room - WebSocket not connected", { chatId });
        return;
      }

      // 🛑 already in the room – do nothing
      if (currentRoomsRef.current.has(chatId)) {
        logInfo(`Already in room ${chatId}, skipping join`);
        return;
      }

      logInfo(`Joining training room: ${chatId}`);
      socketRef.current.emit("join_training", {
        chat_id: chatId,
        profile_id: profileId,
      });
      currentRoomsRef.current.add(chatId);

      // Data channel will be created in webrtc_ready callback
    },
    [profileId]
  );

  const leaveRoom = useCallback((chatId: string) => {
    if (!socketRef.current) {
      logInfo("Cannot leave room - WebSocket not available", { chatId });
      return;
    }

    // 🛑 not in the room – nothing to leave
    if (!currentRoomsRef.current.has(chatId)) {
      logInfo(`Not in room ${chatId}, skipping leave`);
      return;
    }

    logInfo(`Leaving training room: ${chatId}`);
    socketRef.current.emit("leave_training", {
      chat_id: chatId,
    });
    currentRoomsRef.current.delete(chatId);

    const channelLabel = `text-${chatId}`;
    const channel = webRTCDataChannels.current.get(channelLabel);
    if (channel) {
      channel.close();
      webRTCDataChannels.current.delete(channelLabel);
      logInfo(`Closed and removed WebRTC data channel: ${channelLabel}`);
    }
  }, []);

  // Training event emitters
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
      if (!socketRef.current || !socketRef.current.connected) {
        logError("Cannot start training - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsStartingTraining(true);
      logInfo("Emitting start_training", data);
      socketRef.current.emit("start_training", data);
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
      if (!socketRef.current || !socketRef.current.connected) {
        logError("Cannot join training - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      router.push(
        `/dashboard/trainings/t/${data.training_id}/a/${data.attempt_id}`
      );

      setIsStartingTraining(true);
      logInfo("Emitting join_training", data);
      socketRef.current.emit("join_training", data);
    },
    [router]
  );

  const emitSendTrainingMessage = useCallback(
    (data: { chat_id: string; message: string }) => {
      if (!socketRef.current || !socketRef.current.connected) {
        logError("Cannot send training message - WebSocket not connected");
        return;
      }

      setIsSendingTrainingMessage(true);
      logInfo("Emitting send_training_message", { chatId: data.chat_id });
      socketRef.current.emit("send_training_message", data);
    },
    []
  );

  const emitStopTraining = useCallback((data: { chat_id: string }) => {
    if (!socketRef.current || !socketRef.current.connected) {
      logError("Cannot stop training - WebSocket not connected");
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    setIsStoppingTraining(true);
    logInfo("Emitting stop_training", data);
    socketRef.current.emit("stop_training", data);
  }, []);

  const emitEndTraining = useCallback((data: { chat_id: string }) => {
    if (!socketRef.current || !socketRef.current.connected) {
      logError("Cannot end training - WebSocket not connected");
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    setIsEndingTraining(true);
    logInfo("Emitting end_training", data);
    socketRef.current.emit("end_training", data);
  }, []);

  const emitSubmitAssessment = useCallback(
    (data: { chat_id: string; responses: Record<string, unknown> }) => {
      if (!socketRef.current || !socketRef.current.connected) {
        logError("Cannot submit assessment - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsSubmittingAssessment(true);
      logInfo("Emitting submit_assessment", data);
      socketRef.current.emit("submit_assessment", data);
    },
    []
  );

  const emitGetHints = useCallback(
    (data: { chat_id: string; message_id: string }) => {
      if (!socketRef.current || !socketRef.current.connected) {
        logError("Cannot get hints - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsGettingHints(true);
      logInfo("Emitting get_hints", data);
      socketRef.current.emit("get_hints", data);
    },
    []
  );

  // WebRTC functions
  const sendWebRTCMessage = useCallback(
    (chatId: string, message: string) => {
      try {
        const channelLabel = `text-${chatId}`;
        let channel = webRTCDataChannels.current.get(channelLabel);

        if (!channel || channel.readyState === "closed") {
          channel = createDataChannelIfNeeded(channelLabel);
        }

        if (!channel) {
          logError(
            `Could not create or get WebRTC channel ${channelLabel}, falling back to WebSocket`
          );
          emitSendTrainingMessage({ chat_id: chatId, message });
          return;
        }

        const messagePayload = JSON.stringify({
          chat_id: chatId,
          content: message,
        });

        if (channel.readyState === "open") {
          logInfo(
            `Sending WebRTC message directly via open channel ${channelLabel}`
          );
          channel.send(messagePayload);
        } else if (channel.readyState === "connecting") {
          logInfo(
            `WebRTC channel ${channelLabel} is connecting. Queuing message.`
          );
          if (!messageQueues.current.has(channelLabel)) {
            messageQueues.current.set(channelLabel, []);
          }
          messageQueues.current.get(channelLabel)?.push(messagePayload);
        } else {
          logError(
            `WebRTC channel ${channelLabel} in unhandled state: ${channel.readyState}. Falling back to WebSocket.`
          );
          emitSendTrainingMessage({ chat_id: chatId, message });
        }
      } catch (error) {
        logError("Error sending WebRTC message", error);
      }
    },
    [createDataChannelIfNeeded, emitSendTrainingMessage]
  );

  // ✨ NEW: Initialize the audio stream once and keep it open
  const initializeAudioStream = useCallback(
    async (chatId: string) => {
      if (
        !profileId ||
        !socketRef.current ||
        !webRTCPeerConnection.current ||
        userMediaStream.current
      ) {
        logError(
          "Cannot initialize audio stream - requirements not met or stream already exists."
        );
        return;
      }

      try {
        logInfo(`Initializing persistent audio stream for chat: ${chatId}`);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        userMediaStream.current = stream;

        const track = stream.getAudioTracks()[0];
        audioTrackRef.current = track;

        // Mute the track by default immediately after getting it
        track.enabled = false;
        logInfo("Microphone track created and muted by default.");

        const sender = webRTCPeerConnection.current.addTrack(track, stream);
        audioTrackSenders.current.set(chatId, sender);

        // 👇 RESTORE: Trigger renegotiation to update connection for bi-directional audio
        socketRef.current.emit("webrtc_start_audio", {
          chat_id: chatId,
          profile_id: profileId,
        });

        logInfo(`Persistent audio stream established for chat: ${chatId}`);
      } catch (error) {
        logError("Error initializing audio stream", error);
        toast.error("Failed to access microphone. Please check permissions.");
      }
    },
    [profileId]
  );

  // ✨ NEW: A simple, fast function to toggle mute
  const setMicrophoneMuted = useCallback((muted: boolean) => {
    if (audioTrackRef.current) {
      const track = audioTrackRef.current;
      track.enabled = !muted;
      logInfo(
        `Microphone track ${muted ? "muted" : "unmuted"}: enabled=${
          track.enabled
        }, id=${track.id}`
      );
    } else {
      logError("Cannot mute/unmute - no microphone track available");
    }
  }, []);

  // ✨ NEW: Add a function to get the state of the local microphone track
  const getLocalMicTrackState = useCallback(() => {
    const track = audioTrackRef.current;
    if (!track) return null;

    return {
      id: track.id,
      kind: track.kind,
      enabled: track.enabled,
      muted: track.muted, // Note: 'enabled' is the property we control
      readyState: track.readyState,
    };
  }, []);

  // Function to trigger server audio by briefly enabling microphone
  const triggerServerAudio = useCallback(() => {
    if (audioTrackRef.current) {
      const track = audioTrackRef.current;
      logInfo("Triggering server audio by briefly enabling microphone");

      // Briefly enable the microphone to trigger server echo
      track.enabled = true;

      // Disable it after a short delay
      setTimeout(() => {
        if (track) {
          track.enabled = false;
          logInfo("Microphone disabled after triggering server audio");
        }
      }, 100); // 100ms should be enough to trigger the echo
    } else {
      logError("Cannot trigger server audio - no microphone track available");
    }
  }, []);

  const terminateAudioStream = useCallback(
    (chatId: string) => {
      logInfo(`Terminating audio stream for chat: ${chatId}`);
      const sender = audioTrackSenders.current.get(chatId);
      if (sender && webRTCPeerConnection.current) {
        webRTCPeerConnection.current.removeTrack(sender);
        audioTrackSenders.current.delete(chatId);
      }

      if (audioTrackSenders.current.size === 0 && userMediaStream.current) {
        userMediaStream.current.getTracks().forEach((track) => track.stop());
        userMediaStream.current = null;
        audioTrackRef.current = null;
        logInfo("All audio streams stopped. Mic released.");
      }

      // ✨ NEW: Clear remote stream state when terminating audio
      setRemoteStream(null);

      if (socketRef.current && profileId) {
        socketRef.current.emit("webrtc_stop_audio", {
          chat_id: chatId,
          profile_id: profileId,
        });
      }
    },
    [profileId]
  );

  const value: WebSocketContextType = {
    isConnected,
    socket: socketRef.current,
    isWebRTCConnected,
    isAudioBridgeReady, // ✨ Expose the state through the context
    isStartingTraining,
    isSendingTrainingMessage,
    isStoppingTraining,
    isEndingTraining,
    isSubmittingAssessment,
    isGettingHints, // ✨ Expose hints loading state
    joinRoom,
    leaveRoom,
    sendWebRTCMessage,
    initializeAudioStream,
    setMicrophoneMuted,
    terminateAudioStream,
    audioPlaybackRef, // 👈 ADD THIS LINE
    getTrackState, // Remote track state
    getLocalMicTrackState, // Local microphone track state
    enableServerAudio, // Enable server audio playback
    disableServerAudio, // Disable server audio playback
    triggerServerAudio, // Trigger server audio by sending silent frame
    emitStartTraining,
    emitJoinTraining,
    emitSendTrainingMessage,
    emitStopTraining,
    emitEndTraining,
    emitSubmitAssessment,
    emitGetHints, // ✨ Expose hints emitter
  };

  return (
    <WebSocketContext.Provider value={value}>
      {/* Hidden global audio element to ensure it's mounted before any WebRTC tracks arrive */}
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
