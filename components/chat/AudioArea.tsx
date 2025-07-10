/**
 * AudioArea.tsx
 * Used for audio to text interactions with OpenAI Realtime API.
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, Flex } from '@radix-ui/themes';
import { Chat, Message } from '@/types';
import { createMessage } from '@/utils/mutations/messages/create-message';
import { updateMessage } from '@/utils/mutations/messages/update-message';
import { logError } from '@/utils/logger';
import { getCheatingRealtimeSession } from '@/utils/ai/agents/cheating';
import { getRegularRealtimeSession } from '@/utils/ai/agents/regular';
import { RealtimeItem, RealtimeSession } from '@openai/agents/realtime';
import { generateConversationHistoryRealtime } from '@/utils/ai/chat/conversation-history';
import { generateResumeHistoryRealtime } from '@/utils/ai/chat/resume-history';

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
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transportReady, setTransportReady] = useState(false);
  
  const currentMessageRef = useRef<{ id: string } | null>(null);
  const sessionRef = useRef<RealtimeSession | null>(null);
  const hasSession = useRef(false);
  const processedIds = useRef(new Set<string>());

  // Stable handler reference using useRef to avoid useEffect re-runs
  const historyHandlerRef = useRef<(h: RealtimeItem[]) => void>(() => {});

  const syncTranscriptToMessages = useCallback(async (content: string, role: 'user' | 'assistant') => {
    try {
      if (role === 'user') {
        // Create user message
        await createMessage({
          chat_id: chat.id,
          content: content,
          role: 'user',
          completed: true
        });
      } else {
        // Create or update assistant message
        if (!currentMessageRef.current) {
          currentMessageRef.current = await createMessage({
            chat_id: chat.id,
            content: '',
            role: 'assistant',
            completed: false
          });
        }

        await updateMessage(currentMessageRef.current.id, {
          content: content,
          completed: true,
          completed_at: new Date().toISOString(),
        });

        currentMessageRef.current = null;
      }
    } catch (error) {
      logError('Error syncing transcript:', error);
    }
  }, [chat.id]);

  // Update the handler function on each render but keep stable reference
  historyHandlerRef.current = async (history: RealtimeItem[]) => {
    console.log(history);
    const last = history.at(-1);
    if (!last || last.type !== 'message' || (last.role === 'assistant' && last.status !== 'completed') || last.role === 'system') return;

    // Dedup by itemId so re-emits are ignored
    if (processedIds.current.has(last.itemId)) return;
    processedIds.current.add(last.itemId);

    const text =
      last.role === 'user'
        ? 'text' in last.content[0] ? last.content[0].text : last.content[0].transcript
        : 'text' in last.content[0] ? last.content[0].text : last.content[0].transcript;
    if (!text) return;

    if (last.role === 'user') setCurrentTranscript(text);
    await syncTranscriptToMessages(text, last.role);
  };

  useEffect(() => {
    // Guard against multiple session creation (StrictMode protection)
    if (hasSession.current) return;
    hasSession.current = true;

    let mounted = true;
    const currentProcessedIds = processedIds.current;
    
    (async () => {
      try {
        const session =
          chat.type === 'cheating'
            ? await getCheatingRealtimeSession(chat.title, chat.id)
            : await getRegularRealtimeSession(chat.title, chat.id);

        const resumeHistory = await generateResumeHistoryRealtime(chat);
        const conversationHistory = generateConversationHistoryRealtime(messages);
        const seedHistory = [resumeHistory, ...conversationHistory];

        const formData = new FormData();
        formData.append('chatId', chat.id);
        formData.append('chatTitle', chat.title);
        const { api_key } = await fetch('/api/chat/audio', {
          method: 'POST',
          body: formData
        }).then((r) => r.json());

        await session.connect({ apiKey: api_key });
        session.updateHistory(seedHistory);
        session.options.workflowName = chat.title;
        session.options.groupId = chat.id;
        
        // Mark all seeded history as processed to silence duplicates
        seedHistory.forEach(item => currentProcessedIds.add(item.itemId));

        if (!mounted) return;
        
        // Use stable handler reference
        session.on('history_updated', (h) => historyHandlerRef.current(h));
        
        // Set transport ready when session is connected
        setTransportReady(true);
        
        session.on('error', (e) => onError(String(e.error)));
        
        sessionRef.current = session;
        setIsConnected(true);
      } catch (e) {
        onError(e as string);
      }
    })();

    return () => {
      mounted = false;
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
      hasSession.current = false;
      setIsConnected(false);
      setTransportReady(false);
      currentProcessedIds.clear();
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
      gap: '1.5rem'
    }}>
      <AudioVisualizer isActive={micActive} />

      <Flex direction="column" align="center" gap="3" style={{ textAlign: 'center' }}>
        <Text size="4" weight="medium" color={isConnected ? 'blue' : 'gray'}>
          {isConnected ? 'Connected' : 'Not connected'}
        </Text>

        {currentTranscript && (
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