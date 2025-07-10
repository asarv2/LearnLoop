"use client";

import { useState, useEffect } from 'react';
import { 
  Box, 
  Flex, 
  Heading, 
  Text, 
  Button,
  Separator
} from '@radix-ui/themes';
import * as Dialog from '@radix-ui/react-dialog';
import { FileTextIcon, Cross2Icon, ArrowLeftIcon } from '@radix-ui/react-icons';

interface InterviewHeaderProps {
  candidateName: string;
  interviewType: string;
  isEndingInterview: boolean;
  resumeId: string;
  onEndInterview: () => void;
  isInterviewActive: boolean;
  onShowFeedback?: () => void;
  onBack?: () => void;
  interviewStartTime?: Date;
  completedAt?: Date;
  isAudioMode?: boolean;
  onToggleAudioMode?: () => void;
}

export default function InterviewHeader({
  candidateName,
  interviewType, // Keep for future use
  isEndingInterview,
  resumeId,
  onEndInterview,
  isInterviewActive,
  onShowFeedback,
  onBack,
  interviewStartTime,
  completedAt,
  isAudioMode = false,
  onToggleAudioMode
}: InterviewHeaderProps) {
  // Suppress lint warning for interviewType - keeping for future use
  void interviewType;
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer effect for active interviews
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isInterviewActive && !completedAt && interviewStartTime) {
      // Parse the ISO timestamp to ensure proper timezone handling
      const startTime = interviewStartTime;
      
      // Function to calculate and update elapsed time
      const updateElapsedTime = () => {
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        // Ensure we don't show negative time if there are clock sync issues
        setElapsedTime(Math.max(0, diffInSeconds));
      };
      
      // Set initial time immediately
      updateElapsedTime();
      
      // Update every second
      interval = setInterval(updateElapsedTime, 1000);
    } else if (completedAt && interviewStartTime) {
      // For completed interviews, show the total duration
      const startTime = interviewStartTime;
      const endTime = completedAt;
      const diffInSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      setElapsedTime(Math.max(0, diffInSeconds));
    } else {
      setElapsedTime(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isInterviewActive, interviewStartTime, completedAt]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Box style={{ 
        background: 'var(--gray-1)', 
        borderBottom: '1px solid var(--gray-6)',
        padding: '16px 24px',
        width: '100%'
      }}>
        <Flex align="center" justify="between">
          {/* Left side - Back button, Platform title and candidate */}
          <Flex align="center" gap="4">
            {onBack && (
              <Button
                variant="ghost"
                size="2"
                onClick={onBack}
              >
                <ArrowLeftIcon />
                Back
              </Button>
            )}
            <Box>
              <Heading size="5" weight="bold" color="blue">
                LearnLoop Training Platform
              </Heading>
              <Text size="2" color="gray">
                Interview with {candidateName}
              </Text>
            </Box>
          </Flex>

          {/* Right side - Controls */}
          <Flex align="center" gap="3">
            {isInterviewActive ? (
              <Text size="2" weight="medium" color="gray">
                {formatTime(elapsedTime)}
              </Text>
            ) : (
              <>
                <Text size="2" weight="medium" color="gray">
                  Duration: {formatTime(elapsedTime)}
                </Text>
                <Button 
                  variant="soft" 
                  color="blue" 
                  size="2"
                  onClick={onShowFeedback}
                  disabled={!onShowFeedback}
                >
                  View Feedback
                </Button>
              </>
            )}

            {/* Audio Mode Toggle - only show for active interviews */}
            {isInterviewActive && onToggleAudioMode && (
              <Button 
                variant={isAudioMode ? "solid" : "soft"} 
                color={isAudioMode ? "purple" : "gray"}
                size="2"
                onClick={onToggleAudioMode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="currentColor"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/>
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
                  <path d="M12 18v4"/>
                  <path d="M8 22h8"/>
                </svg>
                {isAudioMode ? 'Audio' : 'Audio'}
              </Button>
            )}

            {/* Resume Button */}
            <Dialog.Root open={isResumeModalOpen} onOpenChange={setIsResumeModalOpen}>
              <Dialog.Trigger asChild>
                <Button variant="soft" size="2">
                  <FileTextIcon />
                  View Resume
                </Button>
              </Dialog.Trigger>
              
              <Dialog.Portal>
                <Dialog.Overlay 
                  style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    animation: 'fadeIn 0.2s ease-out'
                  }}
                />
                <Dialog.Content
                  style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    padding: '24px',
                    width: '90vw',
                    maxWidth: '900px',
                    height: '85vh',
                    overflow: 'hidden',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                    border: '1px solid var(--gray-6)'
                  }}
                >
                  <Flex direction="column" gap="4" style={{ height: '100%' }}>
                    <Flex align="center" justify="between">
                      <Dialog.Title asChild>
                        <Heading size="5" weight="bold" style={{ color: 'var(--gray-12)' }}>
                          Resume - {candidateName}
                        </Heading>
                      </Dialog.Title>
                      <Dialog.Close asChild>
                        <Button 
                          variant="ghost" 
                          size="2"
                          style={{ 
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '6px'
                          }}
                        >
                          <Cross2Icon width="16" height="16" />
                        </Button>
                      </Dialog.Close>
                    </Flex>
                    
                    <Separator size="4" />
                    
                    <Box style={{ flex: 1, border: '1px solid var(--gray-7)', borderRadius: '6px', overflow: 'hidden' }}>
                      {resumeId ? (
                        <iframe
                          src={`/api/resume/${resumeId}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            border: 'none'
                          }}
                          title={`Resume - ${candidateName}`}
                        />
                      ) : (
                        <Flex 
                          align="center" 
                          justify="center" 
                          style={{ height: '100%', color: 'var(--gray-10)' }}
                        >
                          <Text size="3">No resume file available</Text>
                        </Flex>
                      )}
                    </Box>
                  </Flex>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>

            {/* End Interview Button - only show for active interviews */}
            {isInterviewActive && (
              <Button 
                variant="solid" 
                color="red" 
                size="2"
                onClick={onEndInterview}
                loading={isEndingInterview}
                disabled={isEndingInterview}
              >
                {isEndingInterview ? 'Ending...' : 'End Interview'}
              </Button>
            )}
          </Flex>
        </Flex>
      </Box>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}