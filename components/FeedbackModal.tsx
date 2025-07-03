"use client";

import React, { useState } from 'react';
import { 
  Box, 
  Flex, 
  Heading, 
  Text, 
  Button
} from '@radix-ui/themes';
import * as Dialog from '@radix-ui/react-dialog';
import { 
  Cross2Icon, 
  ChevronLeftIcon,
  ChevronRightIcon,
  DotFilledIcon
} from '@radix-ui/react-icons';

interface FeedbackData {
  strengths: string[];
  areasForImprovement: string[];
  overallFeedback: string;
}

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  feedback: FeedbackData | null;
  candidateName: string;
}

export default function FeedbackModal({
  isOpen,
  onClose,
  feedback,
  candidateName
}: FeedbackModalProps) {
  const [currentPage, setCurrentPage] = useState(0);

  if (!feedback) return null;

  const cleanText = (text: string) => {
    // Remove markdown bold formatting (**text**)
    return text.replace(/\*\*(.*?)\*\*/g, '$1');
  };

  const formatOverallFeedback = (text: string) => {
    const cleanedText = cleanText(text);
    const sentences = cleanedText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = [];
    
    for (let i = 0; i < sentences.length; i += 2) {
      const paragraph = sentences.slice(i, i + 2).join('. ').trim();
      if (paragraph) {
        paragraphs.push(paragraph + (paragraph.endsWith('.') ? '' : '.'));
      }
    }
    
    return paragraphs.length > 0 ? paragraphs : [cleanedText];
  };

  const feedbackParagraphs = formatOverallFeedback(feedback.overallFeedback);

  const pages = [
    {
      title: "Strengths",
      icon: "✓",
      color: "green",
      content: (
        <Box style={{ 
          padding: '48px',
          background: 'white',
          height: '100%'
        }}>
          <Flex direction="column" gap="6">
            {feedback.strengths.length > 0 ? (
              <Flex direction="column" gap="4">
                {feedback.strengths.map((strength, index) => (
                  <Box key={index} style={{ 
                    position: 'relative',
                    padding: '28px 32px',
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)',
                    border: '1px solid rgba(22, 163, 74, 0.1)',
                    transition: 'all 0.2s ease',
                    cursor: 'default'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)';
                  }}>
                                         <Flex align="start" gap="4">
                       <Box style={{
                         width: '6px',
                         height: '6px',
                         backgroundColor: '#16a34a',
                         borderRadius: '50%',
                         marginTop: '12px',
                         flexShrink: 0
                       }} />
                       <Text size="3" style={{ 
                         lineHeight: '1.7', 
                         color: '#1f2937',
                         fontWeight: '400',
                         fontSize: '15px'
                       }}>
                         {cleanText(strength)}
                       </Text>
                     </Flex>
                     <Box style={{
                       position: 'absolute',
                       top: 0,
                       left: 0,
                       bottom: 0,
                       width: '4px',
                       backgroundColor: '#16a34a',
                       borderTopLeftRadius: '16px',
                       borderBottomLeftRadius: '16px'
                     }} />
                  </Box>
                ))}
              </Flex>
            ) : (
              <Box style={{ 
                padding: '48px',
                textAlign: 'center',
                backgroundColor: 'white',
                borderRadius: '16px',
                border: '2px dashed #d1d5db'
              }}>
                <Text size="3" style={{ color: '#6b7280', fontStyle: 'italic' }}>
                  No specific strengths identified in this session.
                </Text>
              </Box>
            )}
          </Flex>
        </Box>
      )
    },
    {
      title: "Areas for Improvement",
      icon: "⚡",
      color: "amber",
      content: (
        <Box style={{ 
          padding: '48px',
          background: 'white',
          height: '100%'
        }}>
          <Flex direction="column" gap="6">
            {feedback.areasForImprovement.length > 0 ? (
              <Flex direction="column" gap="4">
                {feedback.areasForImprovement.map((area, index) => (
                  <Box key={index} style={{ 
                    position: 'relative',
                    padding: '28px 32px',
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)',
                    border: '1px solid rgba(245, 158, 11, 0.1)',
                    transition: 'all 0.2s ease',
                    cursor: 'default'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)';
                  }}>
                                         <Text size="3" style={{ 
                       lineHeight: '1.7', 
                       color: '#1f2937',
                       fontWeight: '400',
                       fontSize: '15px'
                     }}>
                       {cleanText(area)}
                     </Text>
                     <Box style={{
                       position: 'absolute',
                       top: 0,
                       left: 0,
                       bottom: 0,
                       width: '4px',
                       backgroundColor: '#f59e0b',
                       borderTopLeftRadius: '16px',
                       borderBottomLeftRadius: '16px'
                     }} />
                  </Box>
                ))}
              </Flex>
            ) : (
              <Box style={{ 
                padding: '48px',
                textAlign: 'center',
                backgroundColor: 'white',
                borderRadius: '16px',
                border: '2px dashed #d1d5db'
              }}>
                <Text size="3" style={{ color: '#6b7280', fontStyle: 'italic' }}>
                  No specific areas for improvement identified.
                </Text>
              </Box>
            )}
          </Flex>
        </Box>
      )
    },
    {
      title: "Detailed Assessment",
      icon: "📋",
      color: "blue",
      content: (
        <Box style={{ 
          padding: '48px',
          background: 'white',
          height: '100%'
        }}>
          <Flex direction="column" gap="6">
            <Flex direction="column" gap="4">
              {feedbackParagraphs.map((paragraph, index) => (
                <Box key={index} style={{ 
                  position: 'relative',
                  padding: '32px 36px',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)',
                  border: '1px solid rgba(59, 130, 246, 0.1)',
                  transition: 'all 0.2s ease',
                  cursor: 'default'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)';
                }}>
                                     <Text size="3" style={{ 
                     lineHeight: '1.8', 
                     color: '#1f2937',
                     fontWeight: '400',
                     fontSize: '15px'
                   }}>
                     {paragraph}
                   </Text>
                   <Box style={{
                     position: 'absolute',
                     top: 0,
                     left: 0,
                     bottom: 0,
                     width: '4px',
                     backgroundColor: '#3b82f6',
                     borderTopLeftRadius: '16px',
                     borderBottomLeftRadius: '16px'
                   }} />
                </Box>
              ))}
            </Flex>
          </Flex>
        </Box>
      )
    }
  ];

  const nextPage = () => {
    setCurrentPage((prev) => (prev + 1) % pages.length);
  };

  const prevPage = () => {
    setCurrentPage((prev) => (prev - 1 + pages.length) % pages.length);
  };

  const goToPage = (index: number) => {
    setCurrentPage(index);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
            padding: '0',
            width: '90vw',
            maxWidth: '600px',
            height: '70vh',
            overflow: 'hidden',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--gray-6)'
          }}
        >
          {/* Header */}
          <Box style={{ 
            background: 'var(--gray-1)',
            padding: '20px 32px',
            borderBottom: '1px solid var(--gray-6)'
          }}>
            <Flex align="center" justify="between">
              <Flex direction="column" gap="1">
                <Dialog.Title asChild>
                  <Heading size="4" weight="medium" style={{ color: 'var(--gray-12)' }}>
                    Interview Feedback
                  </Heading>
                </Dialog.Title>
                <Text size="2" style={{ color: 'var(--gray-11)' }}>
                  {candidateName}
                </Text>
              </Flex>
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
          </Box>

          {/* Page Navigation Tabs */}
          <Box style={{ 
            background: 'var(--gray-1)',
            borderBottom: '1px solid var(--gray-6)'
          }}>
            <Flex align="center" justify="center">
              {pages.map((page, index) => (
                <Box
                  key={index}
                  onClick={() => goToPage(index)}
                  style={{
                    padding: '16px 24px',
                    cursor: 'pointer',
                    borderBottom: currentPage === index ? '3px solid var(--blue-9)' : '3px solid transparent',
                    backgroundColor: currentPage === index ? 'white' : 'transparent',
                    transition: 'all 0.2s ease',
                    fontWeight: currentPage === index ? '600' : '500'
                  }}
                >
                  <Text size="2" style={{ 
                    color: currentPage === index ? 'var(--blue-11)' : 'var(--gray-11)' 
                  }}>
                    {page.title}
                  </Text>
                </Box>
              ))}
            </Flex>
          </Box>

          {/* Page Content */}
          <Box style={{ 
            flex: 1,
            overflow: 'auto',
            height: 'calc(70vh - 160px)',
            background: 'white'
          }}>
            {pages[currentPage].content}
          </Box>

          {/* Footer Navigation */}
          <Box style={{ 
            background: 'var(--gray-1)',
            padding: '16px 32px',
            borderTop: '1px solid var(--gray-6)'
          }}>
            <Flex align="center" justify="between">
              <Button
                variant="soft"
                size="2"
                onClick={prevPage}
                disabled={currentPage === 0}
              >
                <ChevronLeftIcon />
                Previous
              </Button>

              {/* Page Indicators */}
              <Flex align="center" gap="1">
                {pages.map((_, index) => (
                  <DotFilledIcon
                    key={index}
                    width="12"
                    height="12"
                    color={currentPage === index ? 'var(--gray-12)' : 'var(--gray-8)'}
                    style={{ cursor: 'pointer' }}
                    onClick={() => goToPage(index)}
                  />
                ))}
              </Flex>

              <Button
                variant="soft"
                size="2"
                onClick={nextPage}
                disabled={currentPage === pages.length - 1}
              >
                Next
                <ChevronRightIcon />
              </Button>
            </Flex>
          </Box>
        </Dialog.Content>
      </Dialog.Portal>

      <style jsx global>{`
        @keyframes fadeIn {
          from { 
            opacity: 0;
          }
          to { 
            opacity: 1;
          }
        }
      `}</style>
    </Dialog.Root>
  );
} 