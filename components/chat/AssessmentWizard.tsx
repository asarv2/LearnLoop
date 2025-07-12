//Assessment Wizard for the interview assessment
"use client";

import { useState } from 'react';
import { Box, Button, Card, Flex, Heading, Text, TextArea } from '@radix-ui/themes';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeftIcon, ChevronRightIcon, Cross2Icon } from '@radix-ui/react-icons';
import { ASSESSMENT_QUESTIONS, getTotalQuestions } from '@/utils/assessment/questions';
import { AssessmentResponse } from '@/types';

interface AssessmentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (responses: AssessmentResponse[]) => void;
  candidateName: string;
  isSubmitting?: boolean;
}

export default function AssessmentWizard({
  isOpen,
  onClose,
  onComplete,
  candidateName,
  isSubmitting = false
}: AssessmentWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<{ [key: string]: string | number }>({});

  const currentQuestion = ASSESSMENT_QUESTIONS[currentStep];
  const totalQuestions = getTotalQuestions();
  const isLastQuestion = currentStep === totalQuestions - 1;
  const allowMultiple = currentQuestion?.id === 'strengths' || currentQuestion?.id === 'red_flags';
  const canProceed = allowMultiple 
    ? responses[currentQuestion?.id] && (responses[currentQuestion?.id] as string).trim().length > 0
    : responses[currentQuestion?.id] !== undefined;

  const handleResponse = (value: string | number) => {
    setResponses(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      // Convert responses to the format expected by the API
      const assessmentResponses: AssessmentResponse[] = Object.entries(responses).map(([question_id, response]) => ({
        question_id,
        response
      }));
      onComplete(assessmentResponses);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const renderQuestionInput = () => {
    const currentResponse = responses[currentQuestion.id];
    
    // Questions 2 and 3 allow multiple selections
    const allowMultiple = currentQuestion.id === 'strengths' || currentQuestion.id === 'red_flags';
    const selectedOptions = allowMultiple ? (currentResponse as string || '').split(',').filter(Boolean) : [];

    const handleMultipleChoice = (option: string) => {
      if (!allowMultiple) {
        handleResponse(option);
        return;
      }

      const currentSelections = (currentResponse as string || '').split(',').filter(Boolean);
      const isSelected = currentSelections.includes(option);
      
      if (isSelected) {
        const newSelections = currentSelections.filter(item => item !== option);
        handleResponse(newSelections.join(','));
      } else {
        const newSelections = [...currentSelections, option];
        handleResponse(newSelections.join(','));
      }
    };

    switch (currentQuestion.type) {
      case 'yes_no':
        return (
          <Flex direction="column" gap="4">
            <Flex align="center" gap="3" style={{ padding: '16px 0' }}>
              <div
                onClick={() => handleResponse('yes')}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: `2px solid ${currentResponse === 'yes' ? 'var(--blue-9)' : 'var(--gray-8)'}`,
                  backgroundColor: currentResponse === 'yes' ? 'var(--blue-9)' : 'white',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease'
                }}
              >
                {currentResponse === 'yes' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'white'
                    }}
                  />
                )}
              </div>
              <Text size="4" weight="medium" style={{ color: 'var(--gray-12)', cursor: 'pointer' }} onClick={() => handleResponse('yes')}>
                Yes
              </Text>
            </Flex>
            <Flex align="center" gap="3" style={{ padding: '16px 0' }}>
              <div
                onClick={() => handleResponse('no')}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: `2px solid ${currentResponse === 'no' ? 'var(--blue-9)' : 'var(--gray-8)'}`,
                  backgroundColor: currentResponse === 'no' ? 'var(--blue-9)' : 'white',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease'
                }}
              >
                {currentResponse === 'no' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'white'
                    }}
                  />
                )}
              </div>
              <Text size="4" weight="medium" style={{ color: 'var(--gray-12)', cursor: 'pointer' }} onClick={() => handleResponse('no')}>
                No
              </Text>
            </Flex>
          </Flex>
        );

      case 'multiple_choice':
        if (allowMultiple) {
          return (
            <Flex direction="column" gap="4">
              <Text size="2" weight="medium" style={{ color: 'var(--gray-11)' }}>
                Select all that apply:
              </Text>
                             <Box style={{ 
                 display: 'grid', 
                 gridTemplateColumns: 'repeat(2, 1fr)', 
                 gap: '16px'
               }}>
                {currentQuestion.options?.map((option: string, index: number) => {
                  const isSelected = selectedOptions.includes(option);
                  return (
                    <Flex align="center" gap="3" key={index} style={{ padding: '12px 0' }}>
                      <div
                        onClick={() => handleMultipleChoice(option)}
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: `2px solid ${isSelected ? 'var(--blue-9)' : 'var(--gray-8)'}`,
                          backgroundColor: isSelected ? 'var(--blue-9)' : 'white',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: 'white'
                            }}
                          />
                        )}
                      </div>
                      <Text 
                        size="3" 
                        weight="medium" 
                        style={{ 
                          color: 'var(--gray-12)', 
                          lineHeight: '1.4',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleMultipleChoice(option)}
                      >
                        {option}
                      </Text>
                    </Flex>
                  );
                })}
              </Box>
            </Flex>
          );
        }

        return (
          <Flex direction="column" gap="4">
            {currentQuestion.options?.map((option: string, index: number) => (
              <Flex align="center" gap="3" key={index} style={{ padding: '12px 0' }}>
                <div
                  onClick={() => handleResponse(option)}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: `2px solid ${currentResponse === option ? 'var(--blue-9)' : 'var(--gray-8)'}`,
                    backgroundColor: currentResponse === option ? 'var(--blue-9)' : 'white',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {currentResponse === option && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'white'
                      }}
                    />
                  )}
                </div>
                <Text 
                  size="3" 
                  weight="medium" 
                  style={{ 
                    color: 'var(--gray-12)', 
                    lineHeight: '1.4',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleResponse(option)}
                >
                  {option}
                </Text>
              </Flex>
            ))}
          </Flex>
        );

      case 'rating':
        return (
          <Flex direction="column" gap="6">
            <Flex justify="between" align="center">
              <Text size="2" weight="medium" style={{ color: 'var(--gray-11)' }}>
                Very Artificial
              </Text>
              <Text size="2" weight="medium" style={{ color: 'var(--gray-11)' }}>
                Very Authentic
              </Text>
            </Flex>
                        <Flex gap="0" style={{ width: '100%', padding: '0 20px', marginTop: '10px', justifyContent: 'space-between' }}>
               {[1, 2, 3, 4, 5].map((rating) => (
                <Flex direction="column" align="center" gap="2" key={rating}>
                  <div
                    onClick={() => handleResponse(rating)}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: `2px solid ${currentResponse === rating ? 'var(--blue-9)' : 'var(--gray-8)'}`,
                      backgroundColor: currentResponse === rating ? 'var(--blue-9)' : 'white',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {currentResponse === rating && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'white'
                        }}
                      />
                    )}
                  </div>
                  <Text size="3" weight="bold" style={{ color: 'var(--gray-12)', cursor: 'pointer' }} onClick={() => handleResponse(rating)}>
                    {rating}
                  </Text>
                </Flex>
              ))}
            </Flex>
          </Flex>
        );

      case 'text':
        return (
          <TextArea
            placeholder="Please provide your detailed thoughts and observations..."
            value={currentResponse as string || ''}
            onChange={(e) => handleResponse(e.target.value)}
            rows={6}
            style={{ 
              width: '100%',
              fontSize: '15px',
              lineHeight: '1.5',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid var(--gray-7)',
              backgroundColor: 'var(--gray-1)',
              resize: 'vertical',
              minHeight: '140px'
            }}
          />
        );

      default:
        return null;
    }
  };

  if (!currentQuestion) {
    return null;
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.3s ease-out',
            zIndex: 1000
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '0',
            width: '90vw',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'hidden',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            border: 'none',
            zIndex: 1001
          }}
        >
          {/* Header */}
          <Box style={{ 
            padding: '32px 40px 24px', 
            borderBottom: '1px solid var(--gray-6)',
            background: 'linear-gradient(135deg, var(--gray-1) 0%, var(--gray-2) 100%)'
          }}>
            <Flex justify="between" align="start">
              <Box style={{ flex: 1 }}>
                <Dialog.Title asChild>
                  <Heading size="6" weight="bold" style={{ 
                    color: 'var(--gray-12)',
                    marginBottom: '8px',
                    letterSpacing: '-0.02em'
                  }}>
                    Interview Assessment
                  </Heading>
                </Dialog.Title>
                <Text size="3" style={{ 
                  color: 'var(--gray-11)', 
                  fontWeight: '500'
                }}>
                  Candidate: {candidateName}
                </Text>
              </Box>
              <Dialog.Close asChild>
                <Button 
                  variant="ghost" 
                  size="2" 
                  style={{ 
                    color: 'var(--gray-11)',
                    padding: '8px',
                    borderRadius: '8px'
                  }}
                >
                  <Cross2Icon width="18" height="18" />
                </Button>
              </Dialog.Close>
            </Flex>
            
            {/* Progress Section */}
            <Box style={{ marginTop: '24px' }}>
              <Flex justify="between" align="center" style={{ marginBottom: '12px' }}>
                <Text size="2" weight="medium" style={{ color: 'var(--gray-11)' }}>
                  Question {currentStep + 1} of {totalQuestions}
                </Text>
                <Text size="2" weight="medium" style={{ color: 'var(--gray-11)' }}>
                  {Math.round(((currentStep + 1) / totalQuestions) * 100)}% Complete
                </Text>
              </Flex>
              <Box 
                style={{ 
                  width: '100%', 
                  height: '6px', 
                  backgroundColor: 'var(--gray-5)', 
                  borderRadius: '3px',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)'
                }}
              >
                <Box 
                  style={{ 
                    width: `${((currentStep + 1) / totalQuestions) * 100}%`, 
                    height: '100%', 
                    background: 'linear-gradient(90deg, var(--blue-9) 0%, var(--blue-10) 100%)',
                    transition: 'width 0.4s ease',
                    borderRadius: '3px'
                  }} 
                />
              </Box>
            </Box>
          </Box>

          {/* Question Content */}
          <Box style={{ 
            padding: '40px',
            minHeight: '400px',
            backgroundColor: 'var(--gray-1)'
          }}>
            <Flex direction="column" gap="8">
              <Box>
                <Heading size="5" weight="medium" style={{ 
                  color: 'var(--gray-12)', 
                  lineHeight: '1.4',
                  marginBottom: '16px',
                  letterSpacing: '-0.01em'
                }}>
                  {currentQuestion.question}
                </Heading>
                
                {currentQuestion.context && (
                  <Card size="2" variant="surface" style={{ 
                    padding: '16px 20px',
                    backgroundColor: 'var(--blue-2)',
                    border: '1px solid var(--blue-6)',
                    borderRadius: '8px'
                  }}>
                    <Text size="3" style={{ 
                      color: 'var(--blue-11)', 
                      lineHeight: '1.5',
                      fontStyle: 'italic'
                    }}>
                      {currentQuestion.context}
                    </Text>
                  </Card>
                )}
              </Box>

              <Box>
                {renderQuestionInput()}
              </Box>
            </Flex>
          </Box>

          {/* Footer */}
          <Box style={{ 
            padding: '24px 40px 32px', 
            borderTop: '1px solid var(--gray-6)',
            background: 'linear-gradient(135deg, var(--gray-1) 0%, var(--gray-2) 100%)'
          }}>
            <Flex justify="between" align="center">
              <Button 
                variant="outline" 
                size="3"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '12px 20px',
                  fontWeight: '500',
                  borderRadius: '8px',
                  minWidth: '120px',
                  opacity: currentStep === 0 ? '0.5' : '1',
                  color: 'var(--gray-12)',
                  borderColor: 'var(--gray-8)',
                  backgroundColor: 'var(--gray-2)'
                }}
              >
                <ChevronLeftIcon width="16" height="16" />
                Previous
              </Button>
              
              <Button 
                variant="solid" 
                size="3"
                onClick={handleNext}
                disabled={!canProceed}
                loading={isSubmitting && isLastQuestion}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '12px 24px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  minWidth: '140px',
                  backgroundColor: canProceed ? 'var(--blue-9)' : 'var(--gray-7)',
                  boxShadow: canProceed ? '0 2px 8px rgba(0, 123, 255, 0.3)' : 'none'
                }}
              >
                {isLastQuestion ? 'Complete Assessment' : 'Next Question'}
                {!isLastQuestion && <ChevronRightIcon width="16" height="16" />}
              </Button>
            </Flex>
          </Box>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}