/**
 * app/page.tsx
 * The main page for the interview simulation platform.
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
  Spinner
} from '@radix-ui/themes';
import { FileTextIcon, PlayIcon } from '@radix-ui/react-icons';
import InterviewSimulation from '@/components/InterviewSimulation';
interface PDFData {
  fileName: string;
  fileSize: number;
  pdfData: string; // base64 encoded PDF
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [interviewType, setInterviewType] = useState('Mechanical Engineering');
  const [isLoading, setIsLoading] = useState(false);
  const [pdfData, setPdfData] = useState<PDFData | null>(null);
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
    if (!selectedFile || !candidateName.trim()) {
      alert('Please select a resume file and enter the candidate name');
      return;
    }

    setIsLoading(true);

    try {
      let pdfResult;
      
      // Check if we're using the sample resume (already have pdfData)
      if (pdfData && selectedFile.name === 'John_Doe_Resume.pdf') {
        // Use the already loaded sample resume data
        pdfResult = pdfData;
      } else {
        // Process PDF data from uploaded file
        const result = await processPDFData();
        if (!result) {
          throw new Error('Failed to process PDF data');
        }
        setPdfData(result);
        pdfResult = result;
      }

      // Start interview - now we'll pass the PDF data directly
      const formData = new FormData();
      formData.append('candidateName', candidateName);
      formData.append('interviewType', interviewType);
      formData.append('resume', selectedFile);

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
    setInterviewStarted(false);
    setChatId('');
    // Optionally reset other state if needed
    // setSelectedFile(null);
    // setCandidateName('');
    // setResumeData(null);
    // setFormattedResumeText('');
  };

  if (interviewStarted && chatId) {
    return (
      <InterviewSimulation
        candidateName={candidateName}
        resumePDFFile={resumePDFFile}
        interviewType={interviewType}
        chatId={chatId}
        onBack={handleBack}
      />
    );
  }

  return (
    <Box maxWidth="800px" mx="auto" p="6">
      {/* Header */}
      <Card size="4" mb="6" style={{ background: 'linear-gradient(135deg, var(--blue-1) 0%, var(--purple-1) 100%)', border: '1px solid var(--blue-6)' }}>
        <Flex direction="column" align="center" gap="4" p="6">
          <Heading size="8" weight="bold" align="center" color="blue">
            LearnLoop Training Platform
          </Heading>
          <Text size="4" align="center" color="gray">
            Professional Interview Simulation for Mechanical Engineers
          </Text>
          <Text size="2" align="center" color="gray" style={{ maxWidth: '600px' }}>
            Practice your interviewing skills by conducting realistic interview simulations. 
            Upload a candidate&apos;s resume and engage in an AI-powered interview experience.
          </Text>
        </Flex>
      </Card>

      {/* Setup Form */}
      <Card size="4">
        <Flex direction="column" gap="6" p="6">
          <Heading size="5" weight="bold">
            Start New Interview Simulation
          </Heading>

          {/* Candidate Name */}
          <Box>
            <Text size="3" weight="medium" mb="2">
              Candidate Name
            </Text>
            <input
              type="text"
              placeholder="Enter the candidate&apos;s name"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid var(--gray-6)',
                fontSize: '16px'
              }}
            />
            <Text size="1" color="gray" mt="1">
                             This will be used as the candidate&apos;s identity in the simulation
            </Text>
          </Box>

          {/* Interview Type */}
          <Box>
            <Text size="3" weight="medium" mb="2">
              Interview Type
            </Text>
            <input
              type="text"
              value={interviewType}
              onChange={(e) => setInterviewType(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid var(--gray-6)',
                fontSize: '16px'
              }}
            />
            <Text size="1" color="gray" mt="1">
              The type of engineering position being interviewed for
            </Text>
          </Box>

          {/* Resume Upload */}
          <Box>
            <Text size="3" weight="medium" mb="2">
              Candidate Resume (PDF)
            </Text>
            <Card 
              size="3" 
              style={{ 
                border: '2px dashed var(--gray-6)', 
                background: 'var(--gray-1)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => document.getElementById('resume-upload')?.click()}
            >
              <Flex direction="column" align="center" gap="3" p="4">
                <FileTextIcon width="32" height="32" color="var(--gray-9)" />
                {selectedFile ? (
                  <>
                    <Text size="3" weight="medium" color="green">
                      {selectedFile.name}
                    </Text>
                    <Text size="2" color="gray">
                      Click to change file
                    </Text>
                  </>
                ) : (
                  <>
                    <Text size="3" weight="medium">
                      Click to upload resume
                    </Text>
                    <Text size="2" color="gray">
                      PDF files only
                    </Text>
                  </>
                )}
              </Flex>
            </Card>
            <input
              id="resume-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </Box>

          {/* Sample Resume Button */}
          <Box>
            <Text size="2" color="gray" mb="2">
              For testing purposes:
            </Text>
            <Button
              variant="soft"
              size="2"
              onClick={async () => {
                try {
                  setCandidateName('John Doe');
                  
                  // Load the actual PDF file for sample resume
                  const pdfResponse = await fetch('/api/resume/pdf');
                  const pdfBlob = await pdfResponse.blob();
                  const pdfFile = new File([pdfBlob], 'John_Doe_Resume.pdf', { type: 'application/pdf' });
                  setResumePDFFile(pdfFile);
                  setSelectedFile(pdfFile);
                  
                  // Set a placeholder PDF data
                  setPdfData({
                    fileName: 'John_Doe_Resume.pdf',
                    fileSize: pdfFile.size,
                    pdfData: '' // Will be processed when interview starts
                  });
                } catch (error) {
                  console.error('Error loading sample resume:', error);
                }
              }}
            >
              Use Sample Resume (John Doe)
            </Button>
          </Box>

          {/* Start Button */}
          <Button
            size="4"
            onClick={startInterview}
            disabled={!selectedFile || !candidateName.trim() || isLoading}
            style={{ width: '100%' }}
          >
            {isLoading ? (
              <Flex align="center" gap="2">
                <Spinner size="2" />
                <Text>Starting Interview...</Text>
              </Flex>
            ) : (
              <Flex align="center" gap="2">
                <PlayIcon />
                <Text>Start Interview Simulation</Text>
              </Flex>
            )}
          </Button>

          {/* Info */}
          <Card size="2" style={{ background: 'var(--blue-1)', border: '1px solid var(--blue-6)' }}>
            <Text size="2" color="blue">
              <strong>How it works:</strong> Once you start the simulation, you&apos;ll be conducting an interview 
              with an AI candidate who will respond based on the uploaded resume. At the end, you&apos;ll receive 
              detailed feedback on your interviewing performance.
            </Text>
          </Card>
        </Flex>
      </Card>
    </Box>
  );
}
