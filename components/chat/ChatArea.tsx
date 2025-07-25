/**
 * ChatArea.tsx
 * Unified text and voice chat interface
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Flex,
    Text,
    Button,
    Card,
} from '@radix-ui/themes';
import { PaperPlaneIcon, PersonIcon, ChatBubbleIcon, SpeakerLoudIcon, Pencil1Icon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Chat, Message } from '@/types';
import Markdown from '@/components/chat/Markdown';

import { logError } from '@/utils/logger';
import { getCheatingRealtimeSession } from '@/utils/ai/agents/cheating';
import { getRegularRealtimeSession } from '@/utils/ai/agents/regular';
import { RealtimeSession } from '@openai/agents/realtime';
import { generateConversationHistoryRealtime } from '@/utils/ai/chat/conversation-history';
import { generateResumeHistoryRealtime } from '@/utils/ai/chat/resume-history';

import { useCreateMessage } from '@/utils/react-query/mutations/useCreateMessage';
import { useQueryClient } from '@tanstack/react-query';

interface ChatAreaProps {
    displayMessages: Message[];
    isSendingMessage: boolean;
    isEndingInterview: boolean;
    streamingMessage: boolean;
    isInterviewActive: boolean;
    currentMessage: string;
    setCurrentMessage: (message: string) => void;
    handleKeyPress: (e: React.KeyboardEvent) => void;
    sendMessage: () => void;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    chat: Chat;
}

export default function ChatArea({
    displayMessages,
    isSendingMessage,
    isEndingInterview,
    isInterviewActive,
    currentMessage,
    setCurrentMessage,
    handleKeyPress,
    sendMessage: originalSendMessage,
    messagesEndRef,
    chat
}: ChatAreaProps) {
    // Mode toggle state
    const [isVoiceMode, setIsVoiceMode] = useState(false);

    // Voice-related state
    const createMessageMutation = useCreateMessage();
    const queryClient = useQueryClient();
    const [micActive, setMicActive] = useState(false);
    const [isVoiceConnected, setIsVoiceConnected] = useState(false);
    const [transportReady, setTransportReady] = useState(false);

    // Hints-related state
    const [showHints, setShowHints] = useState(false);
    const [hints, setHints] = useState<string>('');
    const [isLoadingHints, setIsLoadingHints] = useState(false);
    const [lastAIResponse, setLastAIResponse] = useState<string>('');

    // Voice-related refs
    const currentMessageRef = useRef<{ id: string } | null>(null);
    const tokenPromiseRef = useRef<Promise<string> | null>(null);
    const sessionRef = useRef<RealtimeSession | null>(null);
    const hasSession = useRef(false);
    const assistantTempIdRef = useRef<string | null>(null);

    const pendingUserMessage = useRef<string>('');
    const pendingAIMessage = useRef<string>('');

    // Helper function to patch the React-Query cache for optimistic updates
    const patchCache = useCallback((tempId: string, partial: Partial<Message> | ((prev: Message | undefined) => Partial<Message>)) => {
        if (!chat?.id) return;
        
        queryClient.setQueryData<Message[]>(['messages', chat.id], (old) => {
            const list = old ?? [];
            const i = list.findIndex(m => m.id === tempId);
            
            const updates = typeof partial === 'function' 
                ? partial(i !== -1 ? list[i] : undefined) 
                : partial;
            
            if (i === -1) {
                // Create new optimistic message
                return [...list, {
                    id: tempId,
                    role: 'user',
                    content: '',
                    completed: false,
                    created_at: new Date().toISOString(),
                    chat_id: chat.id,
                    completed_at: new Date().toISOString(), // Use current timestamp for incomplete messages
                    training_id: null,
                    ...updates
                } as Message];
            }
            
            // Update existing message
            const next = [...list];
            next[i] = { ...next[i], ...updates };
            return next;
        });
    }, [chat?.id, queryClient]);

    // Generate hints function
    const generateHints = useCallback(async () => {
        if (!lastAIResponse || !displayMessages.length) return;

        setIsLoadingHints(true);
        try {
            const response = await fetch('/api/chat/hints', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: displayMessages,
                    chatType: chat?.type || 'regular',
                    chatTitle: chat?.title || '',
                    lastAIResponse: lastAIResponse
                })
            });

            const data = await response.json();
            if (data.hints) {
                setHints(data.hints);
            }
        } catch (error) {
            logError('Error generating hints:', error);
        } finally {
            setIsLoadingHints(false);
        }
    }, [lastAIResponse, displayMessages, chat?.type, chat?.title]);

    // Handle hints button click
    const handleHintsClick = useCallback(async () => {
        if (!showHints && !hints && lastAIResponse) {
            await generateHints();
        }
        setShowHints(!showHints);
    }, [showHints, hints, lastAIResponse, generateHints]);

    // Wrapper for sendMessage to close hints
    const sendMessage = useCallback(() => {
        setShowHints(false);
        originalSendMessage();
    }, [originalSendMessage]);



    // Voice session setup
    useEffect(() => {
        // Guard against undefined chat or non-voice mode
        if (!isVoiceMode || !chat?.id) return;

        // Guard against multiple session creation
        if (hasSession.current) return;
        hasSession.current = true;

        let mounted = true;

        (async () => {
            try {
                // Build the session
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

                // Seed history
                const initHistory = [
                    await generateResumeHistoryRealtime(chat),
                    ...generateConversationHistoryRealtime(displayMessages),
                ];

                // Get token
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

                // Start session muted
                session.mute(true);

                if (!mounted) return;

                // Set up handlers
                session.on("transport_event", async (e) => {
                    if (e.type === "input_audio_buffer.speech_started") {
                        // Create optimistic user message for recording
                        const tempId = `temp-${e.itemId}`;
                        patchCache(tempId, { content: '...' });
                    } else if (e.type === "conversation.item.input_audio_transcription.delta") {
                        if (!e.delta) return;
                        // Update optimistic message with transcription delta
                        const tempId = `temp-${e.itemId}`;
                        patchCache(tempId, (prev) => ({ 
                            content: (prev?.content ?? '') + e.delta,
                        }));
                    } else if (e.type === "input_audio_buffer.speech_stopped") {
                        // Update optimistic message to transcribing status
                        const tempId = `temp-${e.itemId}`;
                        patchCache(tempId, { content: '...' });
                    } else if (e.type === "conversation.item.input_audio_transcription.completed") {
                        // Turn placeholder into final text before the mutation so ids line up
                        const tempId = `temp-${e.itemId}`;
                        patchCache(tempId, { content: e.transcript, completed: true });

                        // Now save - onMutate finds the same id and just updates in-place
                        createMessageMutation.mutate({
                            chat_id: chat.id,
                            role: 'user',
                            content: e.transcript.trim(),
                            completed: true
                        });
                    } else if (e.type === 'response.audio_transcript.delta' || e.type === 'response.text.delta') {
                        if (!e.delta) return;
                        
                        // Allocate a single temp id per assistant response
                        if (!assistantTempIdRef.current) {
                            assistantTempIdRef.current = `temp-assistant-${crypto.randomUUID()}`;
                            patchCache(assistantTempIdRef.current, {
                                role: 'assistant',
                                content: '',
                                completed: false
                            });
                        }
                        
                        // Update the same message with each delta
                        patchCache(assistantTempIdRef.current, (prev) => ({
                            content: (prev?.content ?? '') + e.delta
                        }));
                    } else if (e.type === 'response.audio_transcript.done' || e.type === 'response.text.done') {
                        const tempId = assistantTempIdRef.current!;
                        // Final patch so UI shows full text & spinner stops
                        patchCache(tempId, { content: e.transcript, completed: true });

                        // Hit DB — pass tempId so onMutate updates in-place
                        createMessageMutation.mutate({
                            chat_id: chat.id,
                            role: 'assistant',
                            content: e.transcript.trim(),
                            completed: true
                        });

                        // Store the AI response for hints generation
                        const newResponse = e.transcript.trim();
                        if (newResponse !== lastAIResponse) {
                            setLastAIResponse(newResponse);
                            // Clear old hints when there's a new AI response
                            setHints('');
                        }

                        assistantTempIdRef.current = null; // Ready for next answer
                    } else {
                        logError(`Unknown event type: ${e.type}`, e);
                    }
                });

                session.on('error', (e) => {
                    logError('Voice session error:', e);
                    alert(`Voice mode error: ${e.error}. Please try again.`);
                });

                sessionRef.current = session;
                setIsVoiceConnected(true);
                setTransportReady(true);

                logError('Voice session connected successfully');
            } catch (e) {
                logError('Voice session setup error:', e);
                alert(`Voice mode error: ${e}. Please try again.`);
            }
        })().catch(err => {
            logError('Voice session setup error:', err);
            alert(`Voice mode error: ${err}. Please try again.`);
        });

        return () => {
            mounted = false;
            if (sessionRef.current) {
                sessionRef.current.close();
                sessionRef.current = null;
            }
            hasSession.current = false;
            setIsVoiceConnected(false);
            setTransportReady(false);
            // Clear any pending messages
            pendingUserMessage.current = '';
            pendingAIMessage.current = '';
            currentMessageRef.current = null;
            assistantTempIdRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chat?.id, isVoiceMode]);

    // Track AI responses for hints generation (both text and voice modes)
    useEffect(() => {
        const lastMessage = displayMessages[displayMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.completed && lastMessage.content) {
            const newResponse = lastMessage.content;
            if (newResponse !== lastAIResponse) {
                setLastAIResponse(newResponse);
                // Clear old hints when there's a new AI response
                setHints('');
            }
        }
    }, [displayMessages, lastAIResponse]);

    // Create combined messages array for display with optimistic updates
    const getCombinedMessages = useCallback(() => {
        const messages = [...displayMessages];
        return messages
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }, [displayMessages]);

    const handleVoiceStart = () => {
        if (transportReady && sessionRef.current) {
            sessionRef.current.mute(false);
            setMicActive(true);
            logError('Voice recording started');
        }
    };

    const handleVoiceStop = () => {
        if (sessionRef.current) {
            sessionRef.current.mute(true);
            setMicActive(false);
            logError('Voice recording stopped');
        }
    };

    const handleModeToggle = () => {
        setIsVoiceMode(!isVoiceMode);
        // Clear any current transcripts when switching modes
        setCurrentMessage('');
        // Clear pending messages
        pendingUserMessage.current = '';
        pendingAIMessage.current = '';
        currentMessageRef.current = null;
        assistantTempIdRef.current = null;
    };

    // Early return if chat is not available
    if (!chat) {
        return (
            <Box style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'white',
            }}>
                <Text size="3" style={{ color: 'var(--gray-11)' }}>
                    Loading chat...
                </Text>
            </Box>
        );
    }

    return (
        <Box style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'transparent',
            overflow: 'hidden',
        }}>
            {/* Messages */}
            <Box style={{
                flex: 1,
                padding: '24px',
                overflow: 'auto',
                background: 'white'
            }}>
                <Flex direction="column" gap="4">
                    {getCombinedMessages().map((message) => (
                        <Box key={message.id}>
                            <Flex
                                direction={message.role === 'user' ? 'row-reverse' : 'row'}
                                align="start"
                                gap="3"
                            >
                                {/* Avatar */}
                                <Card
                                    size="1"
                                    style={{
                                        padding: '8px',
                                        background: message.role === 'user'
                                            ? 'var(--blue-3)'
                                            : 'var(--green-3)',
                                        border: `1px solid ${message.role === 'user'
                                            ? 'var(--blue-6)'
                                            : 'var(--green-6)'}`,
                                        opacity: message.completed ? 1 : 0.6
                                    }}
                                >
                                    {message.role === 'user' ? (
                                        <PersonIcon color="var(--blue-9)" />
                                    ) : (
                                        <ChatBubbleIcon color="var(--green-9)" />
                                    )}
                                </Card>

                                {/* Message Content */}
                                <Box style={{ maxWidth: '70%' }}>
                                    <Card
                                        size="2"
                                        style={{
                                            background: message.role === 'user'
                                                ? 'var(--blue-2)'
                                                : 'var(--gray-2)',
                                            border: `1px solid ${message.role === 'user'
                                                ? 'var(--blue-7)'
                                                : 'var(--gray-7)'}`,
                                            opacity: message.completed ? 1 : 0.8
                                        }}
                                    >
                                        <Flex direction="column" gap="2">
                                            <Text size="1" style={{ color: 'var(--gray-11)' }} weight="medium">
                                                {message.role === 'user' ? '' : chat?.name || 'John Doe'}
                                            </Text>
                                            <Text size="2" style={{ lineHeight: '1.5', color: 'var(--gray-12)' }}>
                                                <Markdown>
                                                    {message.role === 'assistant' && !message.completed && !message.content
                                                        ? `${chat?.name || 'John Doe'} is thinking...`
                                                        : message.role === 'assistant' && message.completed && !message.content
                                                            ? 'No response'
                                                            : message.content || ''
                                                    }
                                                </Markdown>
                                            </Text>
                                            {message.completed && (
                                                <Text size="1" style={{ color: 'var(--gray-11)' }}>
                                                    {new Date(message.created_at).toLocaleTimeString()}
                                                </Text>
                                            )}
                                        </Flex>
                                    </Card>
                                </Box>
                            </Flex>
                        </Box>
                    ))}

                    <div ref={messagesEndRef} />
                </Flex>
            </Box>

            {/* Input Area */}
            {isInterviewActive && (
                <Box style={{
                    padding: '24px',
                    background: 'transparent',
                    flexShrink: 0
                }}>
                    <Box style={{ position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
                        <Flex direction="column" gap="3">
                            {/* Mode Toggle */}
                            <Flex justify="center" gap="2">
                                <Button
                                    onClick={handleModeToggle}
                                    variant={isVoiceMode ? "outline" : "solid"}
                                    size="2"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '20px',
                                        background: !isVoiceMode ? 'var(--blue-9)' : 'transparent',
                                        color: !isVoiceMode ? 'white' : 'var(--blue-9)',
                                        border: `1px solid var(--blue-9)`,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Pencil1Icon width="16" height="16" />
                                    Text
                                </Button>
                                <Button
                                    onClick={handleModeToggle}
                                    variant={!isVoiceMode ? "outline" : "solid"}
                                    size="2"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '20px',
                                        background: isVoiceMode ? 'var(--green-9)' : 'transparent',
                                        color: isVoiceMode ? 'white' : 'var(--green-9)',
                                        border: `1px solid var(--green-9)`,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <SpeakerLoudIcon width="16" height="16" />
                                    Voice
                                </Button>
                                {/* Hints Button */}
                                {lastAIResponse && (
                                    <Button
                                        onClick={handleHintsClick}
                                        variant="outline"
                                        size="2"
                                        disabled={isLoadingHints}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '20px',
                                            background: 'transparent',
                                            color: 'var(--purple-9)',
                                            border: `1px solid var(--purple-9)`,
                                            cursor: isLoadingHints ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        <InfoCircledIcon width="16" height="16" />
                                        {isLoadingHints ? 'Loading...' : hints ? 'Hints' : 'Get Hints'}
                                    </Button>
                                )}
                            </Flex>

                            {isVoiceMode ? (
                                // Voice Input
                                <Flex direction="column" gap="3" align="center">
                                    {/* Voice Button */}
                                    <Button
                                        onMouseDown={handleVoiceStart}
                                        onMouseUp={handleVoiceStop}
                                        onMouseLeave={handleVoiceStop}
                                        disabled={!isVoiceConnected || !transportReady}
                                        size="3"
                                        style={{
                                            padding: '1rem 2rem',
                                            borderRadius: '30px',
                                            background: micActive
                                                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                                                : (!isVoiceConnected || !transportReady)
                                                    ? 'linear-gradient(135deg, #9ca3af, #6b7280)'
                                                    : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                            color: 'white',
                                            border: 'none',
                                            cursor: isVoiceConnected && transportReady ? 'pointer' : 'not-allowed',
                                            fontSize: '1rem',
                                            fontWeight: '600',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: micActive
                                                ? '0 8px 30px rgba(239, 68, 68, 0.4)'
                                                : (!isVoiceConnected || !transportReady)
                                                    ? '0 4px 15px rgba(156, 163, 175, 0.3)'
                                                    : '0 8px 30px rgba(99, 102, 241, 0.3)',
                                            transform: micActive ? 'scale(1.05)' : 'scale(1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>
                                            {micActive ? '🔴' : (!isVoiceConnected || !transportReady) ? '⏳' : '🎤'}
                                        </span>
                                        {micActive ? 'Recording...' : (!isVoiceConnected || !transportReady) ? 'Connecting...' : 'Hold to Speak'}
                                    </Button>
                                </Flex>
                            ) : (
                                // Text Input
                                <Box style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        placeholder="Type your interview question..."
                                        value={currentMessage}
                                        onChange={(e) => setCurrentMessage(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        disabled={isSendingMessage}
                                        style={{
                                            width: '100%',
                                            padding: '12px 50px 12px 16px',
                                            borderRadius: '24px',
                                            border: '1px solid var(--gray-6)',
                                            fontSize: '16px',
                                            outline: 'none',
                                            background: 'white',
                                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                                            transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = 'var(--blue-7)';
                                            e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1), 0 0 0 3px rgba(59, 130, 246, 0.1)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = 'var(--gray-6)';
                                            e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                                        }}
                                    />
                                    <Button
                                        onClick={sendMessage}
                                        disabled={!currentMessage.trim() || isSendingMessage}
                                        size="1"
                                        style={{
                                            position: 'absolute',
                                            right: '6px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            borderRadius: '20px',
                                            background: currentMessage.trim() && !isSendingMessage ? 'var(--blue-9)' : 'var(--gray-6)',
                                            border: 'none',
                                            width: '36px',
                                            height: '36px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: currentMessage.trim() && !isSendingMessage ? 'pointer' : 'not-allowed'
                                        }}
                                    >
                                        <PaperPlaneIcon width="16" height="16" />
                                    </Button>
                                </Box>
                            )}
                        </Flex>

                    </Box>
                </Box>
            )}

            {/* Hints Popup */}
            {showHints && (
                <Box style={{
                    position: 'fixed',
                    top: '50%',
                    right: '24px',
                    transform: 'translateY(-50%)',
                    zIndex: 1000,
                    maxWidth: '350px',
                    width: '100%'
                }}>
                    <Card
                        size="3"
                        style={{
                            background: 'white',
                            border: '1px solid var(--purple-7)',
                            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
                            borderRadius: '12px'
                        }}
                    >
                        <Flex direction="column" gap="3">
                            <Flex justify="between" align="center">
                                <Text size="3" weight="bold" style={{ color: 'var(--purple-9)' }}>
                                    💡 {chat?.title?.startsWith('Offboarding:') ? 'Offboarding Hints' : 'Interview Hints'}
                                </Text>
                                <Button
                                    onClick={() => setShowHints(false)}
                                    variant="ghost"
                                    size="1"
                                    style={{
                                        color: 'var(--gray-9)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ✕
                                </Button>
                            </Flex>

                            {hints ? (
                                <Box>
                                    <Text size="2" style={{ lineHeight: '1.5', color: 'var(--gray-12)' }}>
                                        <Markdown>{hints}</Markdown>
                                    </Text>
                                </Box>
                            ) : (
                                <Text size="2" style={{ color: 'var(--gray-11)' }}>
                                    {isLoadingHints ? 'Generating hints...' : 'No hints available'}
                                </Text>
                            )}
                        </Flex>
                    </Card>
                </Box>
            )}

            {isEndingInterview && (
                <Box style={{
                    padding: '24px',
                    background: 'var(--gray-1)',
                    flexShrink: 0
                }}>
                    <Card size="2" style={{ background: 'var(--amber-2)', border: '1px solid var(--amber-7)' }}>
                        <Text size="2" align="center" style={{ color: 'var(--amber-11)' }}>
                            Generating feedback...
                        </Text>
                    </Card>
                </Box>
            )}

            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </Box>
    );
}