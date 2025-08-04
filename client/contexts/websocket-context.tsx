/**
 * Global WebSocket Context for managing a single WebSocket connection
 * This provides a centralized way to manage WebSocket connections and events
 * across all components based on the user's profile ID
 */
"use client";

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

  // Loading states for debugging
  isStartingTraining: boolean;
  isSendingTrainingMessage: boolean;
  isStoppingTraining: boolean;
  isEndingTraining: boolean;
  isSubmittingAssessment: boolean;
  isGeneratingFeedback: boolean;

  // Room management (chat_id-based)
  joinRoom: (chatId: string) => void; // should create webRTC data channel (for text) and optionally media channel (for audio)
  leaveRoom: (chatId: string) => void; // should close webRTC data channel (for text) and optionally media channel (for audio)

  // WebRTC Emitters
  sendWebRTCMessage: (chatId: string, message: string) => void;
  startAudioStream: (chatId: string) => Promise<void>;
  stopAudioStream: (chatId: string) => void;

  // Training event emitters
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
  emitGenerateFeedback: (data: { chat_id: string }) => void;
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
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

  // WebRTC state
  const [isWebRTCConnected, setIsWebRTCConnected] = useState(false);
  const webRTCPeerConnection = useRef<RTCPeerConnection | null>(null);
  const webRTCDataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const userMediaStream = useRef<MediaStream | null>(null);
  const audioTrackSenders = useRef<Map<string, RTCRtpSender>>(new Map());

  // Message queues for data channels (text messages)
  const messageQueues = useRef<Map<string, string[]>>(new Map());

  // ICE candidate buffer for handling candidates before remote description is set
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);

  // Flag to prevent multiple webrtc_start emissions on reconnects
  const webrtcStarted = useRef(false);

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
        if (!webrtcStarted.current) {
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
        "training_message_start",
        (data: { chat_id: string; message_id: string }) => {
          logInfo("Training message start", data);
          setIsSendingTrainingMessage(false);

          // Dispatch event for UI components to listen to
          window.dispatchEvent(
            new CustomEvent("trainingMessageStart", {
              detail: {
                chatId: data.chat_id,
                messageId: data.message_id,
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
          logInfo("Dispatching training message token event", {
            chatId: data.chat_id,
            messageId: data.message_id,
            contentLength: data.accumulated_content.length,
          });

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
        (data: { success: boolean; message: string; chat_id: string }) => {
          logInfo("Training ended", data);
          setIsEndingTraining(false);
          if (data.success) {
            toast.success(data.message);
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
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "feedback_generated",
        (data: { success: boolean; message: string; chat_id: string }) => {
          logInfo("Feedback generated", data);
          setIsGeneratingFeedback(false);
          if (data.success) {
            toast.success(data.message);
          } else {
            toast.error(data.message);
          }
        }
      );

      // WebRTC event handlers
      socket.on(
        "webrtc_offer",
        async (data: {
          profile_id: string;
          offer: { sdp: string; type: string };
          ice_config: RTCIceServer[];
        }) => {
          logInfo("Received WebRTC offer", { profileId: data.profile_id });

          try {
            let pc = webRTCPeerConnection.current;

            if (pc && pc.signalingState === "closed") {
              logInfo("Ignoring offer for closed peer connection");
              return;
            }

            if (!pc) {
              logInfo("Creating new PeerConnection for initial setup.");
              pc = new RTCPeerConnection({
                iceServers: data.ice_config,
              });
              webRTCPeerConnection.current = pc;

              pc.onicecandidate = (event) => {
                if (socket.connected) {
                  socket.emit("webrtc_ice_candidate", {
                    profile_id: profileId,
                    candidate: event.candidate
                      ? {
                          candidate: event.candidate.candidate,
                          sdpMid: event.candidate.sdpMid,
                          sdpMLineIndex: event.candidate.sdpMLineIndex,
                        }
                      : null,
                  });
                }
              };

              pc.onconnectionstatechange = () => {
                if (webRTCPeerConnection.current) {
                  const currentState =
                    webRTCPeerConnection.current.connectionState;
                  setIsWebRTCConnected(currentState === "connected");
                  logInfo(`WebRTC connection state: ${currentState}`);
                }
              };

              pc.ontrack = (event) => {
                logInfo("Received remote audio track", {
                  streamId: event.streams[0]?.id,
                  trackKind: event.track.kind,
                });
              };

              pc.ondatachannel = (event) => {
                const channel = event.channel;
                logInfo(`Received data channel from server: ${channel.label}`);

                webRTCDataChannels.current.set(channel.label, channel);

                channel.onopen = () => {
                  logInfo(`Server data channel opened: ${channel.label}`);
                };

                channel.onclose = () => {
                  logInfo(`Server data channel closed: ${channel.label}`);
                  webRTCDataChannels.current.delete(channel.label);
                };

                channel.onerror = (error) => {
                  logError(
                    `Server data channel error for ${channel.label}:`,
                    error
                  );
                };
              };
            }

            await pc.setRemoteDescription({
              sdp: data.offer.sdp,
              type: data.offer.type as RTCSdpType,
            });

            // Flush any ICE candidates gathered before SDP
            pendingIce.current.forEach((candidate) => {
              pc.addIceCandidate(candidate).catch((error) => {
                logError("Error adding pending ICE candidate", error);
              });
            });
            pendingIce.current.length = 0;

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit("webrtc_answer", {
              profile_id: data.profile_id,
              answer: {
                sdp: answer.sdp,
                type: answer.type,
              },
            });

            logInfo("Sent WebRTC answer");
          } catch (error) {
            logError("Error handling WebRTC offer", error);
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
      }
    };
  }, [profileId, createDataChannelIfNeeded]);

  // Room management (chat_id-based)
  const joinRoom = useCallback(
    (chatId: string) => {
      if (!socketRef.current || !isConnected) {
        logInfo("Cannot join room - WebSocket not connected", { chatId });
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
    [isConnected, profileId]
  );

  const leaveRoom = useCallback((chatId: string) => {
    if (!socketRef.current) {
      logInfo("Cannot leave room - WebSocket not available", { chatId });
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
  const emitJoinTraining = useCallback(
    (data: {
      attempt_id: string;
      training_id: string;
      chat_id: string;
      profile_id?: string;
    }) => {
      if (!socketRef.current || !isConnected) {
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
    [isConnected, router]
  );

  const emitSendTrainingMessage = useCallback(
    (data: { chat_id: string; message: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot send training message - WebSocket not connected");
        return;
      }

      setIsSendingTrainingMessage(true);
      logInfo("Emitting send_training_message", { chatId: data.chat_id });
      socketRef.current.emit("send_training_message", data);
    },
    [isConnected]
  );

  const emitStopTraining = useCallback(
    (data: { chat_id: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot stop training - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsStoppingTraining(true);
      logInfo("Emitting stop_training", data);
      socketRef.current.emit("stop_training", data);
    },
    [isConnected]
  );

  const emitEndTraining = useCallback(
    (data: { chat_id: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot end training - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsEndingTraining(true);
      logInfo("Emitting end_training", data);
      socketRef.current.emit("end_training", data);
    },
    [isConnected]
  );

  const emitSubmitAssessment = useCallback(
    (data: { chat_id: string; responses: Record<string, unknown> }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot submit assessment - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsSubmittingAssessment(true);
      logInfo("Emitting submit_assessment", data);
      socketRef.current.emit("submit_assessment", data);
    },
    [isConnected]
  );

  const emitGenerateFeedback = useCallback(
    (data: { chat_id: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot generate feedback - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsGeneratingFeedback(true);
      logInfo("Emitting generate_feedback", data);
      socketRef.current.emit("generate_feedback", data);
    },
    [isConnected]
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

  const startAudioStream = useCallback(
    async (chatId: string) => {
      if (!profileId || !socketRef.current || !webRTCPeerConnection.current) {
        logError("Cannot start audio stream - missing requirements");
        return;
      }

      try {
        logInfo(`Starting audio stream for chat: ${chatId}`);

        if (!userMediaStream.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          userMediaStream.current = stream;
        }

        const audioTrack = userMediaStream.current.getAudioTracks()[0];
        if (audioTrack && webRTCPeerConnection.current) {
          const sender = webRTCPeerConnection.current.addTrack(
            audioTrack,
            userMediaStream.current
          );
          audioTrackSenders.current.set(chatId, sender);

          socketRef.current.emit("webrtc_start_audio", {
            chat_id: chatId,
            profile_id: profileId,
          });
          logInfo(`Started and sent audio stream for chat: ${chatId}`);
        }
      } catch (error) {
        logError("Error starting audio stream", error);
        toast.error("Failed to start microphone. Please check permissions.");
      }
    },
    [profileId]
  );

  const stopAudioStream = useCallback(
    (chatId: string) => {
      logInfo(`Stopping audio stream for chat: ${chatId}`);
      const sender = audioTrackSenders.current.get(chatId);
      if (sender && webRTCPeerConnection.current) {
        webRTCPeerConnection.current.removeTrack(sender);
        audioTrackSenders.current.delete(chatId);
      }

      if (audioTrackSenders.current.size === 0 && userMediaStream.current) {
        userMediaStream.current.getTracks().forEach((track) => track.stop());
        userMediaStream.current = null;
        logInfo("All audio streams stopped. Mic released.");
      }

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
    isStartingTraining,
    isSendingTrainingMessage,
    isStoppingTraining,
    isEndingTraining,
    isSubmittingAssessment,
    isGeneratingFeedback,
    joinRoom,
    leaveRoom,
    sendWebRTCMessage,
    startAudioStream,
    stopAudioStream,
    emitJoinTraining,
    emitSendTrainingMessage,
    emitStopTraining,
    emitEndTraining,
    emitSubmitAssessment,
    emitGenerateFeedback,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
