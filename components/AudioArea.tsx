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
    const currentMessageRef = useRef<{ id: string } | null>(null);
    const [isConnected, setIsConnected] = useState(false);

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

    const handleHistory = useCallback(async (history: RealtimeItem[]) => {
        const last = history.at(-1);
        if (last?.type === 'message' && last.role === 'user' && last.status === 'completed') {
            let text = '';
            if ('text' in last.content[0]) {
                text = last.content[0].text
            } else if ('transcript' in last.content[0] && last.content[0].transcript) {
                text = last.content[0].transcript
            } else {
                throw new Error("Invalid message content");
            }
            setCurrentTranscript(text);
            await syncTranscriptToMessages(text, 'user');
        } else if (last?.type === 'message' && last.role === 'assistant' && last.status === 'completed') {
            let text = '';
            if ('text' in last.content[0]) {
                text = last.content[0].text
            } else if ('transcript' in last.content[0] && last.content[0].transcript) {
                text = last.content[0].transcript
            } else {
                throw new Error("Invalid message content");
            }
            await syncTranscriptToMessages(text, 'assistant');
        }
    }, [syncTranscriptToMessages]);

    useEffect(() => {
        let session: RealtimeSession;
        (async () => {
            try {
                session =
                    chat.type === 'cheating'
                        ? await getCheatingRealtimeSession(chat, messages)
                        : await getRegularRealtimeSession(chat, messages);

                const { api_key } = await fetch('/api/chat/audio', { method: 'POST' })
                    .then(r => r.json());

                await session.connect({ apiKey: api_key }); // never a raw key

                setIsConnected(true);

                session.on('history_updated', handleHistory);
                session.on('error', (e) => onError(e.error as string));
            } catch (e) {
                onError(e as string);
            }
        })();

        return () => session?.close();
    }, [chat, handleHistory, messages, onError]);

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
            <AudioVisualizer isActive={isConnected} />

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
            </Flex>
        </Box>
    );
}