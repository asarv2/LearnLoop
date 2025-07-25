/**
 * AudioArea.tsx
 * Enhanced voice interview UI with professional voice orb animation
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Box, Text, Flex } from '@radix-ui/themes';
import { Chat, Message } from '@/types';
import { createMessage } from '@/utils/mutations/messages/create-message';
import { updateMessage } from '@/utils/mutations/messages/update-message';
import { getCheatingRealtimeSession } from '@/utils/ai/agents/cheating';
import { getRegularRealtimeSession } from '@/utils/ai/agents/regular';
import { RealtimeItem, RealtimeSession } from '@openai/agents/realtime';
import { generateConversationHistoryRealtime } from '@/utils/ai/chat/conversation-history';
import { generateResumeHistoryRealtime } from '@/utils/ai/chat/resume-history';
import { useQueryClient } from '@tanstack/react-query';

interface AudioAreaProps {
  chat: Chat;
  messages: Message[];
  onError: (error: string) => void;
}

interface VoiceOrbProps {
  isActive: boolean;
  isListening: boolean;
  isConnected: boolean;
}

const VoiceOrb = ({ isActive, isListening, isConnected }: VoiceOrbProps) => {
  return (
    <Box style={{
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '300px',
      width: '300px'
    }}>
      {/* Outer ring - connection indicator */}
      <div
        style={{
          position: 'absolute',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          border: `3px solid ${isConnected ? 'rgba(99, 102, 241, 0.3)' : 'rgba(156, 163, 175, 0.3)'}`,
          animation: isConnected ? 'rotate 20s linear infinite' : 'none',
        }}
      />
      
      {/* Middle ring - listening indicator */}
      <div
        style={{
          position: 'absolute',
          width: '220px',
          height: '220px',
          borderRadius: '50%',
          background: isListening 
            ? 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 50%, transparent 100%)'
            : 'transparent',
          animation: isListening ? 'pulse-listening 1.5s ease-in-out infinite' : 'none',
        }}
      />
      
      {/* Inner core - main orb */}
      <div
        style={{
          position: 'absolute',
          width: '160px',
          height: '160px',
          borderRadius: '50%',
          background: isActive 
            ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)'
            : isConnected
            ? 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)'
            : 'linear-gradient(135deg, #6b7280 0%, #9ca3af 50%, #d1d5db 100%)',
          boxShadow: isActive
            ? '0 0 60px rgba(139, 92, 246, 0.6), 0 0 100px rgba(139, 92, 246, 0.3)'
            : isConnected
            ? '0 0 40px rgba(99, 102, 241, 0.4), 0 0 80px rgba(99, 102, 241, 0.2)'
            : '0 0 20px rgba(156, 163, 175, 0.3)',
          animation: isActive ? 'voice-active 0.8s ease-in-out infinite alternate' : 'none',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
      
      {/* Particle effects */}
      {isActive && (
        <>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'rgba(139, 92, 246, 0.7)',
                animation: `particle-${i} 2s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </>
      )}
      
      {/* Center icon */}
      <div
        style={{
          position: 'absolute',
          fontSize: '2.5rem',
          color: 'white',
          opacity: 0.9,
          animation: isActive ? 'icon-pulse 1s ease-in-out infinite' : 'none',
        }}
      >
        {isActive ? '🎤' : isConnected ? '🎧' : '⏸️'}
      </div>
      
      <style jsx>{`
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse-listening {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        
        @keyframes voice-active {
          0% { transform: scale(1); }
          100% { transform: scale(1.05); }
        }
        
        @keyframes icon-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        @keyframes particle-0 {
          0% { transform: translate(0, 0) scale(0); opacity: 0; }
          50% { transform: translate(60px, -80px) scale(1); opacity: 1; }
          100% { transform: translate(120px, -160px) scale(0); opacity: 0; }
        }
        
        @keyframes particle-1 {
          0% { transform: translate(0, 0) scale(0); opacity: 0; }
          50% { transform: translate(80px, -40px) scale(1); opacity: 1; }
          100% { transform: translate(160px, -80px) scale(0); opacity: 0; }
        }
        
        @keyframes particle-2 {
          0% { transform: translate(0, 0) scale(0); opacity: 0; }
          50% { transform: translate(80px, 40px) scale(1); opacity: 1; }
          100% { transform: translate(160px, 80px) scale(0); opacity: 0; }
        }
        
        @keyframes particle-3 {
          0% { transform: translate(0, 0) scale(0); opacity: 0; }
          50% { transform: translate(60px, 80px) scale(1); opacity: 1; }
          100% { transform: translate(120px, 160px) scale(0); opacity: 0; }
        }
        
        @keyframes particle-4 {
          0% { transform: translate(0, 0) scale(0); opacity: 0; }
          50% { transform: translate(-60px, 80px) scale(1); opacity: 1; }
          100% { transform: translate(-120px, 160px) scale(0); opacity: 0; }
        }
        
        @keyframes particle-5 {
          0% { transform: translate(0, 0) scale(0); opacity: 0; }
          50% { transform: translate(-80px, -40px) scale(1); opacity: 1; }
          100% { transform: translate(-160px, -80px) scale(0); opacity: 0; }
        }
      `}</style>
    </Box>
  );
};

export default function AudioArea({ chat, messages, onError }: AudioAreaProps) {
  const queryClient = useQueryClient();
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transportReady, setTransportReady] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const tokenPromiseRef = useRef<Promise<string> | null>(null);
  const sessionRef = useRef<RealtimeSession | null>(null);
  const hasSession = useRef(false);
  const processedIds = useRef(new Set<string>());

  // Stable handler reference using useRef to avoid useEffect re-runs
  const historyHandlerRef = useRef<(h: RealtimeItem[]) => void>(() => { });

  const getTranscript = (it: RealtimeItem) => {
    if (it.type !== "message" || it.role === "system") return "";
    if (!it.content?.length) return "";
    const c = it.content[0];
    if (c.type === "text") return c.text ?? "";
    if (c.type === "audio" || c.type === "input_audio") return c.transcript ?? "";
    return "";
  };

  const itemCache = useRef<
    Map<string, { dbId?: string; text: string; completed: boolean }>
  >(new Map());

  historyHandlerRef.current = async (history: RealtimeItem[]) => {
    // batch promises so React loop doesn’t wait for each write
    const work: Promise<unknown>[] = [];

    for (const it of history) {
      if (it.type !== "message" || it.role === "system") continue;
      if (!it.itemId.startsWith("item_")) continue; // ignore your own seeded rows

      const nextText = getTranscript(it);
      const nextCompleted = it.status === "completed";

      const cached = itemCache.current.get(it.itemId);

      // brand-new itemId
      if (!cached) {
        if (!nextText) {
          // nothing worth storing yet → keep metadata so we can
          // attach a DB id once text shows up, but skip createMessage()
          itemCache.current.set(it.itemId, {
            dbId: undefined,
            text: "",
            completed: nextCompleted,      // we remember it, but don't act on it
          });
          continue;
        }

        // first real transcript ⇒ create DB row
        work.push(
          createMessage({
            chat_id: chat.id,
            content: nextText,
            role: it.role as "user" | "assistant",
            completed: nextCompleted,          // might still be false
            completed_at: nextCompleted ? new Date().toISOString() : undefined,
          }).then(({ id }) => {
            itemCache.current.set(it.itemId, {
              dbId: id,
              text: nextText,
              completed: nextCompleted,
            });
          })
        );
        if (it.role === "assistant") setCurrentTranscript(nextText);
        continue;
      }

      // already seen
      const textChanged = nextText && nextText !== cached.text;
      const completedChanged = nextCompleted && !cached.completed;

      // if we *still* don't have a DB row (dbId undefined)
      // but now we finally have text  → create it here
      if (!cached.dbId && nextText) {
        work.push(
          createMessage({
            chat_id: chat.id,
            content: nextText,
            role: it.role as "user" | "assistant",
            completed: nextCompleted,
            completed_at: nextCompleted ? new Date().toISOString() : undefined,
          }).then(({ id }) => {
            cached.dbId = id;
            cached.text = nextText;
            cached.completed = nextCompleted;
          })
        );
        if (it.role === "assistant") setCurrentTranscript(nextText);
        continue;
      }

      if (!cached.dbId) continue;                 // still waiting for first text

      if (!textChanged && !completedChanged) continue;

      work.push(
        updateMessage(cached.dbId, {
          content: textChanged ? nextText : undefined,
          completed: completedChanged ? true : undefined,
          completed_at: completedChanged ? new Date().toISOString() : undefined,
        }).then(() => {
          if (textChanged) cached.text = nextText;
          if (completedChanged) cached.completed = true;
        })
      );

      if (it.role === "assistant" && textChanged) setCurrentTranscript(nextText);
    }

    if (work.length) {
      await Promise.all(work);
      queryClient.invalidateQueries({ queryKey: ["messages", chat.id] });
    }
  };

  useEffect(() => {
    // Guard against multiple session creation (StrictMode protection)
    if (hasSession.current) return;
    hasSession.current = true;

    let mounted = true;

    (async () => {
      try {
        // 1️⃣ build the session
        let session;
        
        // Check if this is offboarding training
        let additionalInfo;
        try {
          additionalInfo = JSON.parse(chat.additional_info);
        } catch {
          additionalInfo = null;
        }

        if (additionalInfo && additionalInfo.offboarding_type) {
          // This is offboarding training
          const { getOffboardingRealtimeSession } = await import('@/utils/ai/agents/offboarding');
          session = await getOffboardingRealtimeSession(
            chat.title, 
            chat.id, 
            additionalInfo.offboarding_type, 
            additionalInfo.employee_level
          );
        } else if (chat.type === 'cheating') {
          session = await getCheatingRealtimeSession(chat.title, chat.id);
        } else {
          session = await getRegularRealtimeSession(chat.title, chat.id);
        }

        // 2️⃣ seed history *before* connect so server won't echo it back
        const initHistory = [
          await generateResumeHistoryRealtime(chat),
          ...generateConversationHistoryRealtime(messages),
        ];

        // 3️⃣ one token request per component life-cycle
        const formData = new FormData();
        formData.append('chatId', chat.id);
        formData.append('chatTitle', chat.title);
        if (!tokenPromiseRef.current) {
          tokenPromiseRef.current = fetch('/api/chat/audio', { method: 'POST', body: formData })
            .then(r => r.json())
            .then(r => r.api_key);
        }
        const api_key = await tokenPromiseRef.current;

        await session.connect({ apiKey: api_key });
        session.updateHistory(initHistory);

        // Start session muted to prevent background noise
        session.mute(true);

        // 5️⃣ mark seeded IDs to ignore possible echoes
        initHistory.forEach(item => processedIds.current.add(item.itemId));

        // make the last message the current transcript if it is an assistant message
        const lastMessage = initHistory.at(-1);
        if (lastMessage?.type === "message" && lastMessage.role === 'assistant' && lastMessage.status === 'completed' && lastMessage.content[0].type === "text") {
          setCurrentTranscript(lastMessage.content[0].text);
        }

        if (!mounted) return;

        // 4️⃣ stable handler via ref
        session.on('history_updated', (h) => historyHandlerRef.current(h));

        // Set transport ready when session is connected
        setTransportReady(true);

        session.on('error', (e) => onError(String(e.error)));

        sessionRef.current = session;
        setIsConnected(true);
      } catch (e) {
        onError(e as string);
      }
    })().catch(err => onError(String(err)));

    return () => {
      mounted = false;
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
      hasSession.current = false;
      setIsConnected(false);
      setTransportReady(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      processedIds.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]); // Only reconnect when switching to a different chat

  return (
    <Box style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)
        `,
        pointerEvents: 'none'
      }} />
      
      {/* Header */}
      <Box style={{
        position: 'absolute',
        top: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        zIndex: 10
      }}>
        <Text size="6" weight="bold" style={{
          color: 'white',
          marginBottom: '0.5rem',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Voice Interview Session
        </Text>
        <Text size="3" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          {chat.title}
        </Text>
      </Box>

      {/* Captions Toggle Button */}
      <button
        onClick={() => setCaptionsEnabled(!captionsEnabled)}
        style={{
          position: 'absolute',
          top: '2rem',
          right: '2rem',
          padding: '0.75rem 1rem',
          borderRadius: '12px',
          background: captionsEnabled 
            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' 
            : 'rgba(255, 255, 255, 0.1)',
          color: 'white',
          border: captionsEnabled ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: '600',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backdropFilter: 'blur(10px)',
          boxShadow: captionsEnabled 
            ? '0 4px 20px rgba(99, 102, 241, 0.3)' 
            : '0 4px 20px rgba(0, 0, 0, 0.1)',
          zIndex: 10
        }}
        title={captionsEnabled ? 'Hide captions' : 'Show captions'}
      >
        <span style={{ fontSize: '1.2rem' }}>
          {captionsEnabled ? '💬' : '🔇'}
        </span>
        {captionsEnabled ? 'Captions On' : 'Captions Off'}
      </button>

      {/* Main voice orb */}
      <VoiceOrb 
        isActive={micActive} 
        isListening={currentTranscript !== ''} 
        isConnected={isConnected}
      />

      {/* Status and transcript section */}
      <Flex direction="column" align="center" gap="4" style={{ 
        textAlign: 'center',
        marginTop: '2rem',
        maxWidth: '600px',
        padding: '0 2rem'
      }}>
        {/* Connection Status */}
        <Flex align="center" gap="2" style={{
          padding: '0.5rem 1rem',
          borderRadius: '20px',
          background: isConnected 
            ? 'rgba(34, 197, 94, 0.1)' 
            : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${isConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isConnected ? '#22c55e' : '#ef4444',
            animation: isConnected ? 'pulse 2s ease-in-out infinite' : 'none'
          }} />
          <Text size="2" weight="medium" style={{
            color: isConnected ? '#22c55e' : '#ef4444'
          }}>
            {isConnected ? 'Connected & Ready' : 'Connecting...'}
          </Text>
        </Flex>

        {/* Current transcript */}
        {currentTranscript && captionsEnabled && (
          <Box style={{
            padding: '1.5rem',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            maxWidth: '500px',
            margin: '0 auto'
          }}>
            <Text size="3" style={{
              color: 'rgba(255, 255, 255, 0.9)',
              lineHeight: '1.6',
              fontStyle: 'italic'
            }}>
              &ldquo;{currentTranscript}&rdquo;
            </Text>
          </Box>
        )}

        {/* Control button */}
        {isConnected && (
          <button
            onMouseDown={() => {
              // Only unmute if transport is ready
              if (transportReady && sessionRef.current) {
                sessionRef.current.mute(false);
                setMicActive(true);
              }
            }}
            onMouseUp={() => {
              if (sessionRef.current) {
                sessionRef.current.mute(true);
                setMicActive(false);
              }
            }}
            onMouseLeave={() => {
              if (sessionRef.current) {
                sessionRef.current.mute(true);
                setMicActive(false);
              }
            }}
            style={{
              padding: '1rem 2rem',
              borderRadius: '30px',
              background: micActive 
                ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: micActive 
                ? '0 8px 30px rgba(239, 68, 68, 0.4)' 
                : '0 8px 30px rgba(99, 102, 241, 0.3)',
              transform: micActive ? 'scale(1.05)' : 'scale(1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>
              {micActive ? '🔴' : '🎤'}
            </span>
            {micActive ? 'Recording...' : 'Hold to Speak'}
          </button>
        )}
      </Flex>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </Box>
  );
}
