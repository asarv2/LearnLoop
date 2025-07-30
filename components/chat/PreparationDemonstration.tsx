/**
 * PreparationDemonstration.tsx
 * Shows a demonstration between two AI agents with explanation bubbles
 */

"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMessagesByChat } from '@/utils/queries/messages/get-messages-by-chat';
import { getChat } from '@/utils/queries/chats/get-chat';
import { useRouter } from 'next/navigation';
import { logError } from '@/utils/logger';
import {
    Box,
    Flex,
    Text,
    Button,
    Card,
} from '@radix-ui/themes';
import { PersonIcon, ChatBubbleIcon } from '@radix-ui/react-icons';
import { Modal, message } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import Markdown from '@/components/chat/Markdown';

interface PreparationDemonstrationProps {
  chatId: string;
  preparationType: string;
}

interface StreamingMessage {
  id: string;
  content: string;
  completed: boolean;
}

interface ExplanationBubble {
  id: string;
  messageId: string;
  explanation: string;
  showButton: boolean;
}

export default function PreparationDemonstration({
  chatId,
  preparationType,
}: PreparationDemonstrationProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showEndButton, setShowEndButton] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [explanations, setExplanations] = useState<ExplanationBubble[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [isTriggeringNext, setIsTriggeringNext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: chat } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => getChat(chatId)
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => getMessagesByChat(chatId)
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, scrollToBottom]);

  // Show end button after 5 minutes
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowEndButton(true);
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearTimeout(timer);
  }, []);

  const triggerNextMessage = useCallback(async () => {
    if (streamingMessage || isTriggeringNext) return;

    setIsTriggeringNext(true);

    try {
      const formData = new FormData();
      formData.append('chatId', chatId);

      const response = await fetch('/api/preparation/message', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to trigger next message');
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
                case 'assistant_message_created':
                  setStreamingMessage({ 
                    id: data.messageId, 
                    content: '', 
                    completed: false 
                  });
                  break;
                case 'content_delta':
                  setStreamingMessage(prev => 
                    prev ? { ...prev, content: data.content } : null
                  );
                  break;
                case 'message_completed':
                  setStreamingMessage(prev => 
                    prev ? { ...prev, content: data.content, completed: true } : null
                  );
                  await queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
                  setTimeout(() => {
                    setStreamingMessage(null);
                  }, 100);
                  break;
                case 'error':
                  logError('Streaming error:', data.error);
                  setStreamingMessage(null);
                  break;
              }
            } catch (parseError) {
              logError('Error parsing SSE data:', parseError);
            }
          }
        }
      }
    } catch (error) {
      logError('Error triggering next message:', error);
      setStreamingMessage(null);
    } finally {
      setIsTriggeringNext(false);
    }
  }, [chatId, streamingMessage, isTriggeringNext, queryClient]);

  // Auto-trigger conversation between AI agents
  useEffect(() => {
    if (messages.length > 0 && !streamingMessage && !isTriggeringNext) {
      const lastMessage = messages[messages.length - 1];
      const shouldContinueConversation = lastMessage.completed;
      
      if (shouldContinueConversation) {
        // Add a longer delay to avoid rate limiting and make the conversation feel natural
        const timer = setTimeout(() => {
          triggerNextMessage();
        }, 6000); // 6 second delay to give more breathing room

        return () => clearTimeout(timer);
      }
    }
  }, [messages, streamingMessage, isTriggeringNext, triggerNextMessage]);

  // Generate explanations for interviewer messages - memoized to prevent infinite re-renders
  const generateExplanations = useCallback(() => {
    const newExplanations: ExplanationBubble[] = [];
    let interviewerMessageCount = 0;

    // Sort messages by creation time to ensure proper order
    const sortedMessages = [...messages].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sortedMessages.forEach((msg, index) => {
      // Only add explanations for interviewer messages (even indices: 0, 2, 4...)
      if (index % 2 === 0 && msg.content && msg.completed) {
        interviewerMessageCount++;
        
        // Add explanation every 3rd interviewer message (so every 6th message overall)
        if (interviewerMessageCount % 3 === 0) {
          const explanation = generateExplanation(msg.content, interviewerMessageCount);
          newExplanations.push({
            id: `explanation-${msg.id}`,
            messageId: msg.id,
            explanation,
            showButton: false // No buttons - just show the explanation
          });
        }
      }
    });

    return newExplanations;
  }, [messages]);

  useEffect(() => {
    const newExplanations = generateExplanations();
    setExplanations(newExplanations);
  }, [generateExplanations]);

  const generateExplanation = (messageContent: string, messageNumber: number): string => {
    const explanations = [
      "Notice how the interviewer builds rapport with a warm, professional greeting. This helps create a comfortable environment for the candidate.",
      "The interviewer uses an open-ended question to encourage detailed responses. This reveals more information than yes/no questions.",
      "See how the interviewer follows up with specific probes. This demonstrates active listening and helps uncover concrete examples.",
      "The interviewer transitions smoothly between topics. This keeps the conversation flowing naturally and maintains engagement.",
      "Notice the professional tone throughout. The interviewer remains approachable while maintaining appropriate boundaries.",
      "The interviewer asks behavioral questions that require specific examples. This helps assess real-world experience and skills.",
      "See how the interviewer handles the response professionally. This shows how to manage unexpected or difficult answers.",
      "The interviewer demonstrates excellent time management by moving the conversation forward appropriately.",
      "Notice how the interviewer references specific details from the candidate's responses. This shows active listening.",
      "The interviewer uses follow-up questions effectively to dig deeper into interesting points mentioned by the candidate."
    ];

    return explanations[(messageNumber - 1) % explanations.length];
  };



  const handleEndPreparation = async () => {
    try {
      // Mark preparation as completed
      const response = await fetch('/api/preparation/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          preparationType
        }),
      });

      if (response.ok) {
        setShowCompletionModal(true);
      } else {
        message.error('Failed to complete preparation');
      }
    } catch (error) {
      console.error('Error completing preparation:', error);
      message.error('Failed to complete preparation');
    }
  };

  const handleGoToTrainings = () => {
    router.push('/dashboard/trainings');
  };

  const handleBackToPreparation = () => {
    router.push('/dashboard/preparation');
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
      created_at: new Date().toISOString(),
      training_id: chat?.training_id || null
    });
  }

  // Sort messages by creation time to ensure proper order
  const sortedDisplayMessages = displayMessages.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

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
          Loading preparation...
        </Text>
      </Box>
    );
  }

  return (
    <Box style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'white'
    }}>
      {/* Fixed Header */}
      <Box style={{
        padding: '16px 24px',
        background: 'var(--gray-1)',
        borderBottom: '1px solid var(--gray-6)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000
      }}>
        <Text size="4" weight="bold" style={{ color: 'var(--gray-12)' }}>
          {chat?.title || 'Preparation Demonstration'}
        </Text>
        
        <Flex gap="3">
          <Button 
            variant="outline"
            onClick={handleBackToPreparation}
          >
            Back to Preparation
          </Button>
          
          {!streamingMessage && messages.length === 0 && (
            <Button 
              variant="solid"
              style={{ background: 'var(--blue-9)', color: 'white' }}
              onClick={triggerNextMessage}
              disabled={isTriggeringNext}
            >
              {isTriggeringNext ? 'Starting...' : 'Start Conversation'}
            </Button>
          )}
          

          
          {showEndButton && (
            <Button 
              variant="solid"
              style={{ background: 'var(--green-9)', color: 'white' }}
              onClick={handleEndPreparation}
            >
              End Preparation
            </Button>
          )}
        </Flex>
      </Box>

      {/* Messages */}
      <Box style={{
        flex: 1,
        padding: '24px',
        paddingTop: '80px', // Account for fixed header
        overflow: 'auto',
        background: 'white'
      }}>
        {/* Status message */}
        {messages.length === 0 && !streamingMessage && (
          <Box style={{
            padding: '16px',
            background: 'var(--blue-1)',
            border: '1px solid var(--blue-6)',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <Text size="2" style={{ color: 'var(--blue-11)' }}>
              💡 This is a demonstration of excellent interviewing techniques. Watch how the interviewer builds rapport, asks effective questions, and demonstrates active listening. Learning points will appear to explain why certain approaches work well.
            </Text>
          </Box>
        )}
        
        <Flex direction="column" gap="4">
          {sortedDisplayMessages.map((message, index) => {
            // Determine if this is an interviewer message based on message index
            // Even indices (0, 2, 4...) are interviewer, odd indices (1, 3, 5...) are candidate
            const isInterviewer = index % 2 === 0;
            const explanation = explanations.find(exp => exp.messageId === message.id);
            
            return (
              <Box key={`${message.id}-${index}`}>
                <Flex
                  direction={isInterviewer ? 'row' : 'row-reverse'}
                  align="start"
                  gap="3"
                >
                  {/* Avatar */}
                  <Card
                    size="1"
                    style={{
                      padding: '8px',
                      background: isInterviewer
                        ? 'var(--green-3)'
                        : 'var(--blue-3)',
                      border: `1px solid ${isInterviewer
                        ? 'var(--green-6)'
                        : 'var(--blue-6)'}`,
                      opacity: message.completed === false ? 0.7 : 1
                    }}
                  >
                    {isInterviewer ? (
                      <ChatBubbleIcon color="var(--green-9)" />
                    ) : (
                      <PersonIcon color="var(--blue-9)" />
                    )}
                  </Card>

                  {/* Message Content */}
                  <Box style={{ maxWidth: '70%' }}>
                    <Card
                      size="2"
                      style={{
                        background: isInterviewer
                          ? 'var(--gray-2)'
                          : 'var(--blue-2)',
                        border: `1px solid ${isInterviewer
                          ? 'var(--gray-7)'
                          : 'var(--blue-7)'}`,
                        opacity: message.completed === false ? 0.8 : 1
                      }}
                    >
                      <Flex direction="column" gap="2">
                        <Text size="1" style={{ color: 'var(--gray-11)' }} weight="medium">
                          {isInterviewer ? 'Interviewer' : 'Candidate'}
                        </Text>
                        <Text size="2" style={{ lineHeight: '1.5', color: 'var(--gray-12)' }}>
                          <Markdown>
                            {message.content || ''}
                          </Markdown>
                        </Text>
                        {message.completed !== false && (
                          <Text size="1" style={{ color: 'var(--gray-11)' }}>
                            {new Date(message.created_at).toLocaleTimeString()}
                          </Text>
                        )}
                      </Flex>
                    </Card>
                    
                    {/* Explanation Bubble */}
                    {explanation && (
                      <Box style={{
                        marginTop: '8px',
                        padding: '12px 16px',
                        background: 'var(--amber-2)',
                        border: '1px solid var(--amber-7)',
                        borderRadius: '8px',
                        borderLeft: '4px solid var(--amber-9)'
                      }}>
                        <Text size="2" style={{ color: 'var(--amber-11)', fontWeight: 500 }}>
                          💡 Learning Point:
                        </Text>
                        <Text size="2" style={{ color: 'var(--amber-11)', display: 'block', marginTop: '4px' }}>
                          {explanation.explanation}
                        </Text>
                        
                        
                      </Box>
                    )}
                  </Box>
                </Flex>
              </Box>
            );
          })}
          
          <div ref={messagesEndRef} />
        </Flex>
      </Box>

      {/* Completion Modal */}
      <Modal
        open={showCompletionModal}
        onCancel={() => setShowCompletionModal(false)}
        footer={null}
        width={500}
        centered
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <CheckCircleFilled style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
          <Text size="4" weight="bold" style={{ marginBottom: '16px', display: 'block' }}>
            Great job completing the preparation!
          </Text>
          <Text size="2" style={{ color: 'var(--gray-11)', display: 'block', marginBottom: '24px' }}>
            You&apos;ve learned the key techniques for conducting professional interviews. 
            Now it&apos;s time to practice these skills yourself!
          </Text>
          
          <Flex gap="3" justify="center">
            <Button 
              variant="solid"
              style={{ background: 'var(--blue-9)', color: 'white' }}
              onClick={handleGoToTrainings}
            >
              Go to Trainings
            </Button>
            <Button 
              variant="outline"
              onClick={handleBackToPreparation}
            >
              Back to Preparation
            </Button>
          </Flex>
        </div>
      </Modal>
    </Box>
  );
} 