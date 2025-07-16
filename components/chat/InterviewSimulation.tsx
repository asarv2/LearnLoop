/**
 * InterviewSimulation.tsx
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

"use client";

import { useState, useRef, useEffect } from 'react';
import InterviewHeader from './InterviewHeader';
import FeedbackModal from './FeedbackModal';
import AssessmentWizard from './AssessmentWizard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMessagesByChat } from '@/utils/queries/messages/get-messages-by-chat';
import { getChat } from '@/utils/queries/chats/get-chat';
import { useRouter } from 'next/navigation';
import { logError } from '@/utils/logger';
import { getFeedbackByChat } from '@/utils/queries/feedback/get-feedback-by-chat';
import ChatArea from './ChatArea';
import { Box } from '@radix-ui/themes';
import { Assessment } from '@/types';

interface InterviewSimulationProps {
  chatId: string;
}

interface StreamingMessage {
  id: string;
  content: string;
  completed: boolean;
}

export default function InterviewSimulation({
  chatId,
}: InterviewSimulationProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentMessage, setCurrentMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isEndingInterview, setIsEndingInterview] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: chat } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => getChat(chatId)
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => getMessagesByChat(chatId)
  });

  const { data: feedback } = useQuery({
    queryKey: ['feedback', chatId],
    queryFn: () => getFeedbackByChat(chatId)
  });

  // Determine if interview is active based on chat completion status
  const isInterviewActive = chat ? !chat.completed : true;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const sendMessage = async () => {
    if (!currentMessage.trim() || isSendingMessage || !isInterviewActive) return;

    const userMessage = currentMessage;
    setCurrentMessage('');
    setIsSendingMessage(true);
    setStreamingMessage(null);

    try {
      const formData = new FormData();
      formData.append('chatId', chatId);
      formData.append('message', userMessage);

      const response = await fetch('/api/chat/message', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'user_message_created':
                  // Immediately add the user message to the query cache
                  queryClient.setQueryData(['messages', chatId], (oldMessages: typeof messages) => {
                    if (!oldMessages) return [data.message];
                    // Check if message already exists to avoid duplicates
                    const exists = oldMessages.some(msg => msg.id === data.message.id);
                    if (exists) return oldMessages;
                    return [...oldMessages, data.message];
                  });
                  break;

                case 'assistant_message_created':
                  setStreamingMessage({
                    id: data.messageId,
                    content: '',
                    completed: false
                  });
                  break;

                case 'content_delta':
                  setStreamingMessage(prev => prev ? {
                    ...prev,
                    content: data.content
                  } : null);
                  break;

                case 'message_completed':
                  setStreamingMessage(prev => prev ? {
                    ...prev,
                    content: data.content,
                    completed: true
                  } : null);

                  // Invalidate messages query to refetch updated data
                  await queryClient.invalidateQueries({
                    queryKey: ['messages', chatId]
                  });

                  // Clear streaming message after a brief delay
                  setTimeout(() => {
                    setStreamingMessage(null);
                  }, 100);
                  break;

                case 'error':
                  logError('Streaming error:', data.error);
                  setStreamingMessage(null);

                  // Invalidate messages query to refetch updated data
                  await queryClient.invalidateQueries({
                    queryKey: ['messages', chatId]
                  });
                  break;
              }
            } catch (parseError) {
              logError('Error parsing SSE data:', parseError);
            }
          }
        }
      }
    } catch (error) {
      logError('Error sending message:', error);
      setStreamingMessage(null);

      // Invalidate messages query to ensure we have the latest data
      await queryClient.invalidateQueries({
        queryKey: ['messages', chatId]
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const endInterview = async () => {
    setIsEndingInterview(true);

    try {
      // Just mark interview as completed and show assessment wizard
      await queryClient.invalidateQueries({
        queryKey: ['chat', chatId]
      });
      setShowAssessment(true);
    } catch (error) {
      logError('Error ending interview:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to end interview: ${errorMessage}. Please check the console for more details.`);
    } finally {
      setIsEndingInterview(false);
    }
  };

  const handleAssessmentComplete = async (responses: Assessment['responses']) => {
    setIsSubmittingAssessment(true);

    try {
      const response = await fetch('/api/chat/assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId,
          responses: responses
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Invalidate both chat and feedback queries to get the updated data
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['chat', chatId]
          }),
          queryClient.invalidateQueries({
            queryKey: ['feedback', chatId]
          })
        ]);
        setShowAssessment(false);
        setShowFeedback(true);
      } else {
        logError('Assessment processing failed:', data);
        throw new Error(data.error || 'Failed to process assessment');
      }
    } catch (error) {
      logError('Error processing assessment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to process assessment: ${errorMessage}. Please check the console for more details.`);
    } finally {
      setIsSubmittingAssessment(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Combine regular messages with streaming message for display
  const displayMessages = [...messages];
  if (streamingMessage) {
    displayMessages.push({
      id: streamingMessage.id,
      content: streamingMessage.content,
      role: 'assistant' as const,
      chat_id: chatId,
      completed: streamingMessage.completed,
      completed_at: '',
      created_at: new Date().toISOString()
    });
  }

  return (
    <Box style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <InterviewHeader
        candidateName={chat?.name || 'John Doe'}
        interviewType={chat?.type || ''}
        resumeId={chat?.resume_id || ''}
        onEndInterview={endInterview}
        isInterviewActive={isInterviewActive}
        isEndingInterview={isEndingInterview}
        onShowFeedback={() => setShowFeedback(true)}
        onBack={() => router.push('/interview')}
        interviewStartTime={chat?.created_at ? new Date(chat.created_at) : undefined}
        completedAt={chat?.completed_at ? new Date(chat.completed_at) : undefined}
      />

      <ChatArea
        displayMessages={displayMessages}
        isSendingMessage={isSendingMessage}
        isEndingInterview={isEndingInterview}
        streamingMessage={!!streamingMessage}
        isInterviewActive={isInterviewActive}
        currentMessage={currentMessage}
        setCurrentMessage={setCurrentMessage}
        handleKeyPress={handleKeyPress}
        sendMessage={sendMessage}
        chat={chat!}
        messagesEndRef={messagesEndRef}
      />

      {/* Assessment Wizard */}
      <AssessmentWizard
        isOpen={showAssessment}
        onClose={() => setShowAssessment(false)}
        onComplete={handleAssessmentComplete}
        candidateName={chat?.name || 'John Doe'}
        isSubmitting={isSubmittingAssessment}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        feedback={feedback?.[0] || null}
        candidateName={chat?.name || 'John Doe'}
      />
    </Box>
  );
}