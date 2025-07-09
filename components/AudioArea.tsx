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
import { RealtimeSession } from '@openai/agents/realtime';
import { generateResumeHistoryRealtime } from '@/utils/ai/chat/resume-history';
import { generateConversationHistoryRealtime } from '@/utils/ai/chat/conversation-history';

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



    useEffect(() => {
        const connectToRealtimeSession = async () => {
            try {
                if (chat) {
                    let realtimeSession: RealtimeSession;
                    if (chat.type === "cheating") {
                        realtimeSession = getCheatingRealtimeSession()
                    } else if (chat.type === "regular") {
                        realtimeSession = getRegularRealtimeSession()
                    } else {
                        throw new Error("Invalid chat type");
                    }
                    const resumeHistory = await generateResumeHistoryRealtime(chat);
                    const conversationHistory = generateConversationHistoryRealtime(messages);
                    realtimeSession.updateHistory([resumeHistory, ...conversationHistory]);
                    await realtimeSession.connect({
                        apiKey: "ek_686edf3879f48191ae1efe33cfe2269f"
                    })
                    setIsConnected(true)
                    realtimeSession.addListener('conversation.item.input_audio_transcription.completed',
                        // @ts-expect-error - this is a valid event
                        async (evt: { transcript: string }) => {
                            const text = evt.transcript as string;
                            setCurrentTranscript(text);
                            await syncTranscriptToMessages(text, 'user');
                        });
                    realtimeSession.addListener('conversation.item.response.text.completed',
                        // @ts-expect-error - this is a valid event
                        async (evt: { text: string }) => {
                            const text = evt.text as string;
                            await syncTranscriptToMessages(text, 'assistant');
                        });
                }
            } catch (error) {
                onError(error as string);
            }
        }
        connectToRealtimeSession();
    }, [chat, syncTranscriptToMessages, messages, onError]);
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