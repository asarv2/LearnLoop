"use client";

import { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Flex, 
  Text, 
  Button,
  Card,
  Spinner
} from '@radix-ui/themes';
import { PaperPlaneIcon, PersonIcon, ChatBubbleIcon } from '@radix-ui/react-icons';
import InterviewHeader from './InterviewHeader';
import FeedbackModal from './FeedbackModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMessagesByChat } from '@/utils/queries/messages/get-messages-by-chat';
import { getChat } from '@/utils/queries/chats/get-chat';
import { useRouter } from 'next/navigation';
import { logError } from '@/utils/logger';
import { getFeedbackByChat } from '@/utils/queries/feedback/get-feedback-by-chat';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isInterviewActive, setIsInterviewActive] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading || !isInterviewActive) return;

    const userMessage = currentMessage;
    setCurrentMessage('');
    setIsLoading(true);
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
                case 'message_created':
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
                  console.error('Streaming error:', data.error);
                  setStreamingMessage(null);
                  
                  // Invalidate messages query to refetch updated data
                  await queryClient.invalidateQueries({
                    queryKey: ['messages', chatId]
                  });
                  break;
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
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
      setIsLoading(false);
    }
  };

  const endInterview = async () => {
    setIsInterviewActive(false);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('chatId', chatId);

      const response = await fetch('/api/chat/end', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // Invalidate feedback query to get the new feedback
        await queryClient.invalidateQueries({
          queryKey: ['feedback', chatId]
        });
        setShowFeedback(true);
      } else {
        console.error('Feedback generation failed:', data);
        throw new Error(data.error || 'Failed to generate feedback');
      }
    } catch (error) {
      console.error('Error generating feedback:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to generate feedback: ${errorMessage}. Please check the console for more details.`);
    } finally {
      setIsLoading(false);
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
        onShowFeedback={() => setShowFeedback(true)}
        onBack={() => router.push('/')}
      />

      {/* Chat Area */}
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
            {displayMessages.map((message) => (
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
                        : 'var(--green-6)'}`
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
                          : 'var(--gray-7)'}`
                      }}
                    >
                      <Flex direction="column" gap="2">
                        <Text size="1" style={{ color: 'var(--gray-11)' }} weight="medium">
                          {message.role === 'user' ? '' : chat?.name || 'John Doe'}
                        </Text>
                        <Text size="2" style={{ lineHeight: '1.5', color: 'var(--gray-12)' }}>
                          {message.role === 'assistant' && !message.completed && !message.content 
                            ? `${chat?.name || 'John Doe'} is thinking...`
                            : message.role === 'assistant' && message.completed && !message.content
                            ? 'No response'
                            : message.content
                          }
                          {message.role === 'assistant' && !message.completed && message.content && (
                            <span style={{ opacity: 0.7 }}>▊</span>
                          )}
                        </Text>
                        <Text size="1" style={{ color: 'var(--gray-11)' }}>
                          {new Date(message.created_at).toLocaleTimeString()}
                        </Text>
                      </Flex>
                    </Card>
                  </Box>
                </Flex>
              </Box>
            ))}
            
            {isLoading && !streamingMessage && (
              <Flex align="center" gap="2" justify="start">
                <Card size="1" style={{ padding: '8px', background: 'var(--green-3)' }}>
                  <ChatBubbleIcon color="var(--green-9)" />
                </Card>
                <Card size="2" style={{ background: 'var(--gray-2)', border: '1px solid var(--gray-7)' }}>
                  <Flex align="center" gap="2" p="3">
                    <Spinner size="1" />
                    <Text size="2" style={{ color: 'var(--gray-11)' }}>
                      {chat?.name || 'John Doe'} is thinking...
                    </Text>
                  </Flex>
                </Card>
              </Flex>
            )}
            
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
              <input
                type="text"
                placeholder="Type your interview question..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
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
                disabled={!currentMessage.trim() || isLoading}
                size="1"
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  borderRadius: '20px',
                  background: currentMessage.trim() && !isLoading ? 'var(--blue-9)' : 'var(--gray-6)',
                  border: 'none',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: currentMessage.trim() && !isLoading ? 'pointer' : 'not-allowed'
                }}
              >
                <PaperPlaneIcon width="16" height="16" />
              </Button>
            </Box>
          </Box>
        )}

        {!isInterviewActive && !showFeedback && (
          <Box style={{ 
            padding: '24px',
            background: 'var(--gray-1)',
            flexShrink: 0
          }}>
            <Card size="2" style={{ background: 'var(--amber-2)', border: '1px solid var(--amber-7)' }}>
              <Text size="2" align="center" style={{ color: 'var(--amber-11)' }}>
                Interview completed. Generating feedback...
              </Text>
            </Card>
          </Box>
        )}
      </Box>

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