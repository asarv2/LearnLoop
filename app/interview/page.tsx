/**
 * app/interview/page.tsx
 * Interview setup page for the interview simulation platform.
 * @AshokSaravanan222 & @siladiea
 */

"use client";

import { useState } from 'react';
import { 
  Box, 
  Flex, 
  Heading, 
  Text, 
  Button,
  Card,
  Spinner,
  Badge,
  Container
} from '@radix-ui/themes';
import { FileTextIcon, PlayIcon, CheckIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';
import InterviewSimulation from '@/components/InterviewSimulation';

export default function InterviewPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [interviewType, setInterviewType] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resumePDFFile, setResumePDFFile] = useState<File | null>(null);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [chatId, setChatId] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setResumePDFFile(file); // Store the actual PDF file
    } else {
      alert('Please select a PDF file');
    }
  };

  const processPDFData = async () => {
    if (!selectedFile) return null;

    const formData = new FormData();
    formData.append('resume', selectedFile);

    const response = await fetch('/api/resume/extract', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (data.success) {
      return data;
    } else {
      throw new Error(data.error || 'Failed to process PDF data');
    }
  };

  const startInterview = async () => {
    if (!selectedFile || !candidateName.trim() || !interviewType.trim()) {
      alert('Please complete all steps before starting the interview');
      return;
    }

    setIsLoading(true);

    try {
      // Process PDF data from uploaded file
      const result = await processPDFData();
      if (!result) {
        throw new Error('Failed to process PDF data');
      }

      // Start interview - now we'll pass the PDF data directly
      const formData = new FormData();
      formData.append('candidateName', candidateName);
      formData.append('interviewType', interviewType);
      formData.append('resume', selectedFile);
      formData.append('additionalNotes', additionalNotes);

      const response = await fetch('/api/interview/start', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        setChatId(data.chatId);
        setInterviewStarted(true);
      } else {
        throw new Error(data.error || 'Failed to start interview');
      }
    } catch (error) {
      console.error('Error starting interview:', error);
      alert('Failed to start interview. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (interviewStarted) {
      setInterviewStarted(false);
      setChatId('');
    } else {
      router.push('/');
    }
  };

  const isStepComplete = (step: number) => {
    switch (step) {
      case 1: return candidateName.trim() !== '';
      case 2: return interviewType.trim() !== '';
      case 3: return selectedFile !== null;
      case 4: return additionalNotes.trim() !== '';
      default: return false;
    }
  };

  const allStepsComplete = isStepComplete(1) && isStepComplete(2) && isStepComplete(3);

  if (interviewStarted && chatId) {
    return (
      <InterviewSimulation
        candidateName={candidateName}
        resumePDFFile={resumePDFFile}
        interviewType={interviewType}
        chatId={chatId}
        additionalNotes={additionalNotes}
        onBack={handleBack}
      />
    );
  }

  return (
    <Box style={{ minHeight: '100vh', background: 'var(--gray-1)' }}>
      {/* Header */}
      <Box style={{ 
        background: 'white', 
        borderBottom: '1px solid var(--gray-6)',
        position: 'sticky',
        top: '0',
        zIndex: '100'
      }}>
        <Container size="4">
          <Flex justify="between" align="center" py="4">
            <Flex align="center" gap="3" style={{ cursor: 'pointer' }} onClick={handleBack}>
              <Box style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--blue-9) 0%, var(--purple-9) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Text size="4" weight="bold" style={{ color: 'white' }}>L</Text>
              </Box>
              <Heading size="6" weight="bold">
                LearnLoop
              </Heading>
            </Flex>
            <Badge size="2" variant="soft" color="blue">
              AI Interview Training
            </Badge>
          </Flex>
        </Container>
      </Box>

      {/* Main Content */}
      <Container size="4" py="8">
        {/* Hero Section */}
        <Box mb="10" style={{ textAlign: 'center' }}>
          <Heading size="9" weight="bold" mb="4">
            Start Your Interview Training
          </Heading>
          <Text size="5" color="gray" mb="6" style={{ lineHeight: '1.6', maxWidth: '600px', margin: '0 auto 24px auto' }}>
            Practice with AI-powered candidates and receive detailed feedback on your interviewing performance
          </Text>
        </Box>

        {/* Step Cards with Progress Bars */}
        <Box maxWidth="800px" mx="auto">
          {/* Step 1: Candidate Name */}
          <Box mb="4">
            <Card style={{ 
              background: 'white',
              border: `1px solid ${isStepComplete(1) ? 'var(--green-8)' : 'var(--gray-6)'}`,
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}>
              <Box p="6">
                <Flex align="center" gap="4">
                  <Box style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: isStepComplete(1) ? 'var(--green-9)' : 'var(--gray-7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {isStepComplete(1) ? (
                      <CheckIcon color="white" width="16" height="16" />
                    ) : (
                      <Text size="2" weight="bold" style={{ color: 'white' }}>1</Text>
                    )}
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Flex align="center" gap="2" mb="3">
                      <Text size="4" weight="bold">Candidate Information</Text>
                      {isStepComplete(1) && (
                        <Badge size="1" variant="soft" color="green">Complete</Badge>
                      )}
                    </Flex>

                    <input
                      type="text"
                      placeholder="Enter candidate's full name"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `1px solid ${isStepComplete(1) ? 'var(--green-7)' : 'var(--gray-6)'}`,
                        fontSize: '16px',
                        outline: 'none',
                        background: 'white'
                      }}
                    />
                  </Box>
                </Flex>
              </Box>
            </Card>
          </Box>
          
          {/* Progress Bar 1 */}
          <Flex justify="center" mb="4">
            <Box style={{
              width: '2px',
              height: '24px',
              background: isStepComplete(1) ? 'var(--green-8)' : 'var(--gray-6)',
              borderRadius: '2px'
            }} />
          </Flex>

          {/* Step 2: Position Type */}
          <Box mb="4">
            <Card style={{ 
              background: 'white',
              border: `1px solid ${isStepComplete(2) ? 'var(--green-8)' : 'var(--gray-6)'}`,
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}>
              <Box p="6">
                <Flex align="center" gap="4">
                  <Box style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: isStepComplete(2) ? 'var(--green-9)' : 'var(--gray-7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {isStepComplete(2) ? (
                      <CheckIcon color="white" width="16" height="16" />
                    ) : (
                      <Text size="2" weight="bold" style={{ color: 'white' }}>2</Text>
                    )}
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Flex align="center" gap="2" mb="3">
                      <Text size="4" weight="bold">Position Type</Text>
                      {isStepComplete(2) && (
                        <Badge size="1" variant="soft" color="green">Complete</Badge>
                      )}
                    </Flex>

                    <input
                      type="text"
                      placeholder="e.g., Marketing Manager, Software Engineer, Sales Representative"
                      value={interviewType}
                      onChange={(e) => setInterviewType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `1px solid ${isStepComplete(2) ? 'var(--green-7)' : 'var(--gray-6)'}`,
                        fontSize: '16px',
                        outline: 'none',
                        background: 'white'
                      }}
                    />
                  </Box>
                </Flex>
              </Box>
            </Card>
          </Box>

          {/* Progress Bar 2 */}
          <Flex justify="center" mb="4">
            <Box style={{
              width: '2px',
              height: '24px',
              background: isStepComplete(2) ? 'var(--green-8)' : 'var(--gray-6)',
              borderRadius: '2px'
            }} />
          </Flex>

          {/* Step 3: Resume Upload */}
          <Box mb="4">
            <Card style={{ 
              background: 'white',
              border: `1px solid ${isStepComplete(3) ? 'var(--green-8)' : 'var(--gray-6)'}`,
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}>
              <Box p="6">
                <Flex align="center" gap="4">
                  <Box style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: isStepComplete(3) ? 'var(--green-9)' : 'var(--gray-7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {isStepComplete(3) ? (
                      <CheckIcon color="white" width="16" height="16" />
                    ) : (
                      <Text size="2" weight="bold" style={{ color: 'white' }}>3</Text>
                    )}
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Flex align="center" gap="2" mb="3">
                      <Text size="4" weight="bold">Candidate Resume</Text>
                      {isStepComplete(3) && (
                        <Badge size="1" variant="soft" color="green">Complete</Badge>
                      )}
                    </Flex>

                    <Box
                      style={{
                        border: `2px dashed ${isStepComplete(3) ? 'var(--green-7)' : 'var(--gray-6)'}`,
                        borderRadius: '8px',
                        padding: '24px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: isStepComplete(3) ? 'var(--green-1)' : 'var(--gray-1)',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => document.getElementById('resume-upload')?.click()}
                    >
                      {selectedFile ? (
                        <Flex direction="column" align="center" gap="2">
                          <CheckIcon width="24" height="24" color="var(--green-9)" />
                          <Text size="3" weight="medium" color="green">
                            {selectedFile.name}
                          </Text>
                          <Text size="1" color="gray">Click to change file</Text>
                        </Flex>
                      ) : (
                        <Flex direction="column" align="center" gap="2">
                          <FileTextIcon width="24" height="24" color="var(--gray-9)" />
                          <Text size="3" weight="medium">Click to upload resume</Text>
                          <Text size="1" color="gray">PDF files only</Text>
                        </Flex>
                      )}
                    </Box>
                    <input
                      id="resume-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </Box>
                </Flex>
              </Box>
            </Card>
          </Box>

          {/* Progress Bar 3 */}
          <Flex justify="center" mb="4">
            <Box style={{
              width: '2px',
              height: '24px',
              background: isStepComplete(3) ? 'var(--green-8)' : 'var(--gray-6)',
              borderRadius: '2px'
            }} />
          </Flex>

          {/* Step 4: Additional Notes (Optional) */}
          <Box mb="4">
            <Card style={{ 
              background: 'white',
              border: `1px solid ${isStepComplete(4) ? 'var(--green-8)' : 'var(--gray-6)'}`,
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}>
              <Box p="6">
                <Flex align="center" gap="4">
                  <Box style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: isStepComplete(4) ? 'var(--green-9)' : 'var(--gray-7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {isStepComplete(4) ? (
                      <CheckIcon color="white" width="16" height="16" />
                    ) : (
                      <Text size="2" weight="bold" style={{ color: 'white' }}>4</Text>
                    )}
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Flex align="center" gap="2" mb="3">
                      <Text size="4" weight="bold">Additional Notes</Text>
                      {isStepComplete(4) ? (
                        <Badge size="1" variant="soft" color="green">Complete</Badge>
                      ) : (
                        <Badge size="1" variant="soft" color="gray">Optional</Badge>
                      )}
                    </Flex>

                    <textarea
                      placeholder="Additional information such as stage of the interview, interviewee level, etc..."
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `1px solid ${isStepComplete(4) ? 'var(--green-7)' : 'var(--gray-6)'}`,
                        fontSize: '16px',
                        outline: 'none',
                        background: 'white',
                        minHeight: '80px',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  </Box>
                </Flex>
              </Box>
            </Card>
          </Box>

          {/* Progress Bar 4 */}
          <Flex justify="center" mb="4">
            <Box style={{
              width: '2px',
              height: '24px',
              background: allStepsComplete ? 'var(--green-8)' : 'var(--gray-6)',
              borderRadius: '2px'
            }} />
          </Flex>

          {/* Step 5: Start Interview */}
          <Box>
            <Card style={{ 
              background: allStepsComplete ? 'white' : 'var(--gray-2)',
              border: `1px solid ${allStepsComplete ? 'var(--blue-7)' : 'var(--gray-6)'}`,
              borderRadius: '12px',
              boxShadow: allStepsComplete ? '0 4px 12px rgba(0, 100, 200, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}>
              <Box p="6">
                <Flex align="center" gap="4">
                  <Box style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: allStepsComplete ? 'var(--blue-9)' : 'var(--gray-7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <PlayIcon color="white" width="16" height="16" />
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Flex align="center" gap="2" mb="3">
                      <Text size="4" weight="bold">Start Interview Simulation</Text>
                      {allStepsComplete && (
                        <Badge size="1" variant="soft" color="blue">Ready to start</Badge>
                      )}
                    </Flex>

                    <Button
                      size="3"
                      onClick={startInterview}
                      disabled={!allStepsComplete || isLoading}
                      style={{ 
                        width: '100%',
                        background: allStepsComplete ? 'var(--blue-9)' : 'var(--gray-6)',
                        opacity: allStepsComplete ? 1 : 0.6,
                        cursor: allStepsComplete ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {isLoading ? (
                        <Flex align="center" gap="2">
                          <Spinner size="2" />
                          <Text>Starting Interview...</Text>
                        </Flex>
                      ) : (
                        <Flex align="center" gap="2">
                          <PlayIcon />
                          <Text>Start Interview</Text>
                        </Flex>
                      )}
                    </Button>
                  </Box>
                </Flex>
              </Box>
            </Card>
          </Box>
        </Box>
      </Container>
    </Box>
  );
} 