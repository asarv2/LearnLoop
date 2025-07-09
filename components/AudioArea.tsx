/**
 * AudioArea.tsx
 * Used for audio to text interactions with OpenAI Realtime API.
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, Button, Flex } from '@radix-ui/themes';
import { Chat } from '@/types';
import { generateResumeHistory } from '@/utils/ai/chat/resume-history';
import { createMessage } from '@/utils/mutations/messages/create-message';
import { updateMessage } from '@/utils/mutations/messages/update-message';
import { logError, logInfo } from '@/utils/logger';

interface AudioAreaProps {
    chat: Chat;
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

export default function AudioArea({ chat, onError }: AudioAreaProps) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [status, setStatus] = useState('Click to start audio conversation');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const currentMessageRef = useRef<{ id: string } | null>(null);

    const cleanup = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        setIsConnected(false);
        setIsConnecting(false);
        setIsListening(false);
        setCurrentTranscript('');
        currentMessageRef.current = null;
    }, []);

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

    const handleError = useCallback((error: string) => {
        logError('Audio error:', error);
        setStatus(`Error: ${error}`);
        onError(error);
        cleanup();
    }, [onError, cleanup]);

    const processAudioWithOpenAI = useCallback(async (audioBlob: Blob) => {
        try {
            // Convert audio to text using OpenAI Whisper (placeholder for now)
            setCurrentTranscript('Processing audio...');

            // TODO: Implement actual OpenAI Realtime API integration
            // For now, we'll simulate the process
            logInfo(`Processing audio blob: ${audioBlob.size} bytes`);

            // Simulate transcription
            setTimeout(async () => {
                const simulatedTranscript = 'This is a simulated transcription of the user audio.';
                setCurrentTranscript(simulatedTranscript);
                await syncTranscriptToMessages(simulatedTranscript, 'user');

                // Simulate AI response
                setTimeout(async () => {
                    const simulatedResponse = 'This is a simulated AI response to your audio input.';
                    await syncTranscriptToMessages(simulatedResponse, 'assistant');
                    setCurrentTranscript('');
                    setStatus('Ready. Start speaking...');
                }, 1500);
            }, 1000);

        } catch (error) {
            handleError(`Failed to process audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, [handleError, syncTranscriptToMessages]);

    const initializeAudioSession = useCallback(async () => {
        try {
            setIsConnecting(true);
            setStatus('Setting up audio session...');

            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            });

            // Set up MediaRecorder for audio capture
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
                if (audioBlob.size > 0) {
                    await processAudioWithOpenAI(audioBlob);
                }
                audioChunksRef.current = [];
                setIsListening(false);
            };

            // Generate resume context for the session
            const resumeHistory = await generateResumeHistory(chat, true);
            logInfo('Resume context prepared for audio session:', resumeHistory);

            setIsConnected(true);
            setIsConnecting(false);
            setStatus('Connected. Click and hold to speak...');

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            handleError(`Failed to initialize audio session: ${errorMessage}`);
        }
    }, [chat, handleError, processAudioWithOpenAI]);

    const startRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
            mediaRecorderRef.current.start(100); // Collect data every 100ms
            setIsListening(true);
            setStatus('Listening... Release to send');
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setStatus('Processing...');
        }
    }, []);

    const handleStartStop = useCallback(async () => {
        if (isConnected) {
            cleanup();
            setStatus('Click to start audio conversation');
        } else {
            await initializeAudioSession();
        }
    }, [isConnected, initializeAudioSession, cleanup]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

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
            <AudioVisualizer isActive={isConnected && isListening} />

            <Flex direction="column" align="center" gap="3" style={{ textAlign: 'center' }}>
                <Text size="4" weight="medium" color={isConnected ? 'blue' : 'gray'}>
                    {status}
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

                <Flex gap="2" align="center">
                    <Button
                        size="3"
                        variant={isConnected ? "solid" : "soft"}
                        color={isConnected ? "red" : "blue"}
                        onClick={handleStartStop}
                        disabled={isConnecting}
                        style={{ minWidth: '120px' }}
                    >
                        {isConnecting
                            ? 'Connecting...'
                            : isConnected
                                ? 'End Audio'
                                : 'Start Audio'
                        }
                    </Button>

                    {isConnected && (
                        <Button
                            size="3"
                            variant="soft"
                            color="purple"
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            onMouseLeave={stopRecording}
                            disabled={!isConnected || isListening}
                            style={{ minWidth: '120px' }}
                        >
                            {isListening ? 'Recording...' : 'Hold to Speak'}
                        </Button>
                    )}
                </Flex>

                {isConnected && (
                    <Text size="2" color="gray" style={{ maxWidth: '300px' }}>
                        Click and hold the &ldquo;Hold to Speak&rdquo; button to record your message. Release to send.
                    </Text>
                )}
            </Flex>
        </Box>
    );
}