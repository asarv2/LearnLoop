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

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface InterviewSimulationProps {
  candidateName: string;
  resumePDFFile?: File | null;
  interviewType: string;
  candidateType: string;
  chatId: string;
  additionalNotes?: string;
  initialMessage?: string;
  onBack?: () => void;
}

export default function InterviewSimulation({
  candidateName,
  resumePDFFile,
  interviewType,
  candidateType,
  chatId,
  additionalNotes,
  initialMessage = "Hello! Thank you for taking the time to meet with me today.",
  onBack
}: InterviewSimulationProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: initialMessage,
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInterviewActive, setIsInterviewActive] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading || !isInterviewActive) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: currentMessage,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('chatId', chatId);
      formData.append('message', currentMessage);
      formData.append('candidateName', candidateName);
      formData.append('interviewType', interviewType);
      formData.append('candidateType', candidateType);
      
      // Include additional notes if available
      if (additionalNotes) {
        formData.append('additionalNotes', additionalNotes);
      }
      
      // Include PDF file if available
      if (resumePDFFile) {
        formData.append('resumePDF', resumePDFFile);
      }

      const response = await fetch('/api/interview/message', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.response,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'I apologize, but I&apos;m having trouble responding right now. Could you please try again?',
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
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
      formData.append('candidateName', candidateName);
      formData.append('interviewType', interviewType);
      formData.append('candidateType', candidateType);
      
      // Include additional notes if available
      if (additionalNotes) {
        formData.append('additionalNotes', additionalNotes);
      }
      
      // Include PDF file if available
      if (resumePDFFile) {
        formData.append('resumePDF', resumePDFFile);
      }

      const response = await fetch('/api/interview/feedback', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setFeedback(data.feedback);
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

  return (
    <Box style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <InterviewHeader
        candidateName={candidateName}
        interviewType={interviewType}
        resumePDFFile={resumePDFFile}
        onEndInterview={endInterview}
        isInterviewActive={isInterviewActive}
        onShowFeedback={() => setShowFeedback(true)}
        onBack={onBack}
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
            {messages.map((message) => (
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
                          {message.role === 'user' ? '' : candidateName}
                        </Text>
                        <Text size="2" style={{ lineHeight: '1.5', color: 'var(--gray-12)' }}>
                          {message.content}
                        </Text>
                        <Text size="1" style={{ color: 'var(--gray-11)' }}>
                          {message.timestamp.toLocaleTimeString()}
                        </Text>
                      </Flex>
                    </Card>
                  </Box>
                </Flex>
              </Box>
            ))}
            
            {isLoading && (
              <Flex align="center" gap="2" justify="start">
                <Card size="1" style={{ padding: '8px', background: 'var(--green-3)' }}>
                  <ChatBubbleIcon color="var(--green-9)" />
                </Card>
                <Card size="2" style={{ background: 'var(--gray-2)', border: '1px solid var(--gray-7)' }}>
                  <Flex align="center" gap="2" p="3">
                    <Spinner size="1" />
                    <Text size="2" style={{ color: 'var(--gray-11)' }}>
                      {candidateName} is thinking...
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
        feedback={feedback}
        candidateName={candidateName}
      />
    </Box>
  );
} 