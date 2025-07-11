/**
 * AudioArea.tsx
 * Used for audio to text interactions with OpenAI Realtime API.
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

interface AudioVisualizerProps {
  isActive: boolean;
}

const AudioVisualizer = ({ isActive }: AudioVisualizerProps) => {
  return (
    <Box style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '200px'
    }}>
      <div
        style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: isActive
            ? 'linear-gradient(45deg, #6366f1, #8b5cf6, #a855f7)'
            : 'linear-gradient(45deg, #64748b, #6b7280)',
          animation: isActive ? 'pulse 2s ease-in-out infinite' : 'none',
          boxShadow: isActive
            ? '0 0 30px rgba(139, 92, 246, 0.5)'
            : '0 0 10px rgba(100, 116, 139, 0.3)',
          transition: 'all 0.3s ease'
        }}
      />
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
          }
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
        const session =
          chat.type === 'cheating'
            ? await getCheatingRealtimeSession(chat.title, chat.id)
            : await getRegularRealtimeSession(chat.title, chat.id);

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
      height: '100%',
      padding: '2rem',
      gap: '1.5rem',
      position: 'relative'
    }}>
      {/* Captions Toggle Button */}
      <button
        onClick={() => setCaptionsEnabled(!captionsEnabled)}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          padding: '0.5rem',
          borderRadius: '6px',
          background: captionsEnabled ? '#6366f1' : '#e5e7eb',
          color: captionsEnabled ? '#fff' : '#374151',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: '500',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
        title={captionsEnabled ? 'Hide captions' : 'Show captions'}
      >
        <span style={{ fontSize: '1rem' }}>
          {captionsEnabled ? '🔤' : '🔇'}
        </span>
        {captionsEnabled ? 'Captions On' : 'Captions Off'}
      </button>

      <AudioVisualizer isActive={micActive} />

      <Flex direction="column" align="center" gap="3" style={{ textAlign: 'center' }}>
        <Text size="4" weight="medium" color={isConnected ? 'blue' : 'gray'}>
          {isConnected ? 'Connected' : 'Not connected'}
        </Text>

        {currentTranscript && captionsEnabled && (
          <Text size="3" color="gray" style={{
            fontStyle: 'italic',
            maxWidth: '400px',
            lineHeight: '1.4'
          }}>
            &ldquo;{currentTranscript}&rdquo;
          </Text>
        )}

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
              padding: '0.75rem 1.5rem',
              borderRadius: 6,
              background: micActive ? '#a855f7' : '#e5e7eb',
              color: micActive ? '#fff' : '#374151',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {micActive ? 'Recording…' : 'Hold to Speak'}
          </button>
        )}
      </Flex>
    </Box>
  );
}