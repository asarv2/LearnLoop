"use client";

import { useState } from 'react';
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
  score: number;
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
      content: (
        <Box style={{ padding: '40px' }}>
          <Flex direction="column" gap="4">
            {feedback.strengths.length > 0 ? (
              feedback.strengths.map((strength, index) => (
                <Flex key={index} align="start" gap="3">
                  <Text size="3" style={{ color: 'var(--gray-11)', marginTop: '2px' }}>•</Text>
                  <Text size="3" style={{ lineHeight: '1.6', color: 'var(--gray-12)' }}>
                    {cleanText(strength)}
                  </Text>
                </Flex>
              ))
            ) : (
              <Text size="3" style={{ color: 'var(--gray-10)', fontStyle: 'italic' }}>
                No specific strengths identified in this session.
              </Text>
            )}
          </Flex>
        </Box>
      )
    },
    {
      title: "Areas for Improvement",
      content: (
        <Box style={{ padding: '40px' }}>
          <Flex direction="column" gap="4">
            {feedback.areasForImprovement.length > 0 ? (
              feedback.areasForImprovement.map((area, index) => (
                <Flex key={index} align="start" gap="3">
                  <Text size="3" style={{ color: 'var(--gray-11)', marginTop: '2px' }}>•</Text>
                  <Text size="3" style={{ lineHeight: '1.6', color: 'var(--gray-12)' }}>
                    {cleanText(area)}
                  </Text>
                </Flex>
              ))
            ) : (
              <Text size="3" style={{ color: 'var(--gray-10)', fontStyle: 'italic' }}>
                No specific areas for improvement identified.
              </Text>
            )}
          </Flex>
        </Box>
      )
    },
    {
      title: "Detailed Assessment",
      content: (
        <Box style={{ padding: '40px' }}>
          <Flex direction="column" gap="4">
            {feedbackParagraphs.map((paragraph, index) => (
              <Flex key={index} align="start" gap="3">
                <Text size="3" style={{ color: 'var(--gray-11)', marginTop: '2px' }}>•</Text>
                <Text size="3" style={{ lineHeight: '1.7', color: 'var(--gray-12)' }}>
                  {paragraph}
                </Text>
              </Flex>
            ))}
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
            background: 'white',
            padding: '16px 32px',
            borderBottom: '1px solid var(--gray-6)'
          }}>
            <Flex align="center" justify="center" gap="2">
              {pages.map((page, index) => (
                <>
                  <Button
                    key={index}
                    variant={currentPage === index ? "solid" : "ghost"}
                    size="2"
                    onClick={() => goToPage(index)}
                    style={{
                      backgroundColor: currentPage === index ? 'var(--blue-9)' : 'transparent',
                      color: currentPage === index ? 'white' : 'var(--gray-11)'
                    }}
                  >
                    <Text size="2">{page.title}</Text>
                  </Button>
                  {index < pages.length - 1 && (
                    <Text size="2" style={{ color: 'var(--gray-8)', margin: '0 4px' }}>
                      |
                    </Text>
                  )}
                </>
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