/**
 * InterviewHomepage.tsx
 * Interview landing page for LearnLoop.
 * @AshokSaravanan222 & @siladiea
 * 2025-07-09
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
import { FileTextIcon, PlayIcon, CheckIcon, ArrowLeftIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';
import { InterviewType } from '@/types';
import { logError } from '@/utils/logger';
import Link from 'next/link';

type PositionLevel = 'entry' | 'intermediate' | 'advanced';

export default function NewInterview() {
    const router = useRouter();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [candidateName, setCandidateName] = useState('');
    const [interviewType, setInterviewType] = useState('');
    const [positionLevel, setPositionLevel] = useState<PositionLevel | ''>('');
    const [isLoading, setIsLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setSelectedFile(file);
        } else {
            alert('Please select a PDF file');
        }
    };

    const startInterview = async () => {
        if (!selectedFile || !candidateName.trim() || !interviewType.trim() || !positionLevel) {
            alert('Please complete all steps before starting the interview');
            return;
        }

        setIsLoading(true);

        try {
            // Always randomly select between regular and dishonest candidates
            const dbInterviewType: InterviewType = Math.random() < 0.5 ? 'regular' : 'cheating';

            const formData = new FormData();
            formData.append('name', candidateName);
            formData.append('position', interviewType);
            formData.append('type', dbInterviewType);
            formData.append('resume', selectedFile);
            formData.append('position_level', positionLevel);

            const response = await fetch('/api/chat/start', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                router.push(`/interview/c/${data.chatId}`);
            } else {
                throw new Error(data.error || 'Failed to start interview');
            }
        } catch (error) {
            logError('Error starting interview:', error instanceof Error ? error.message : 'Unknown error');
            alert('Failed to start interview. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const isStepComplete = (step: number) => {
        switch (step) {
            case 1: return candidateName.trim() !== '';
            case 2: return interviewType.trim() !== '';
            case 3: return positionLevel !== '';
            case 4: return selectedFile !== null;
            default: return false;
        }
    };

    const allStepsComplete = isStepComplete(1) && isStepComplete(2) && isStepComplete(3) && isStepComplete(4);


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
                        <Link href="/">
                            <Flex align="center" gap="3" style={{ cursor: 'pointer' }}>
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
                        </Link>
                        <Badge size="2" variant="soft" color="blue">
                            AI Interview Training
                        </Badge>
                    </Flex>
                </Container>
            </Box>

            {/* Back Button */}
            <Container size="4" pt="4">
                <Link href="/interview">
                    <Button variant="ghost" size="2" style={{ color: 'black' }}>
                        <ArrowLeftIcon width="16" height="16" />
                        Back to Dashboard
                    </Button>
                </Link>
            </Container>

            {/* Main Content */}
            <Container size="4" py="8">
                {/* Hero Section */}
                <Box mb="10" style={{ textAlign: 'center' }}>
                    <Heading size="9" weight="bold" mb="4">
                        Start Your Interview Training
                    </Heading>
                    
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

                    {/* Step 3: Position Level */}
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
                                            <Text size="4" weight="bold">Position Level</Text>
                                            {isStepComplete(3) && (
                                                <Badge size="1" variant="soft" color="green">Complete</Badge>
                                            )}
                                        </Flex>

                                        <Flex direction="column" gap="3">
                                            {/* Entry Level */}
                                            <Card
                                                style={{
                                                    background: positionLevel === 'entry' ? 'var(--green-2)' : 'var(--gray-1)',
                                                    border: `2px solid ${positionLevel === 'entry' ? 'var(--green-7)' : 'var(--gray-6)'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => setPositionLevel('entry')}
                                            >
                                                <Box p="4">
                                                    <Flex align="center" gap="3">
                                                        <Box style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            border: `2px solid ${positionLevel === 'entry' ? 'var(--green-9)' : 'var(--gray-6)'}`,
                                                            background: positionLevel === 'entry' ? 'var(--green-9)' : 'transparent',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {positionLevel === 'entry' && (
                                                                <CheckIcon width="12" height="12" color="white" />
                                                            )}
                                                        </Box>
                                                        <Box>
                                                            <Text size="3" weight="bold">Entry: </Text>
                                                            <Text size="2" color="gray">New graduate or someone still new in the industry</Text>
                                                        </Box>
                                                    </Flex>
                                                </Box>
                                            </Card>

                                            {/* Intermediate Level */}
                                            <Card
                                                style={{
                                                    background: positionLevel === 'intermediate' ? 'var(--blue-2)' : 'var(--gray-1)',
                                                    border: `2px solid ${positionLevel === 'intermediate' ? 'var(--blue-7)' : 'var(--gray-6)'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => setPositionLevel('intermediate')}
                                            >
                                                <Box p="4">
                                                    <Flex align="center" gap="3">
                                                        <Box style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            border: `2px solid ${positionLevel === 'intermediate' ? 'var(--blue-9)' : 'var(--gray-6)'}`,
                                                            background: positionLevel === 'intermediate' ? 'var(--blue-9)' : 'transparent',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {positionLevel === 'intermediate' && (
                                                                <CheckIcon width="12" height="12" color="white" />
                                                            )}
                                                        </Box>
                                                        <Box>
                                                            <Text size="3" weight="bold">Intermediate: </Text>
                                                            <Text size="2" color="gray">Someone who&apos;s been in the industry for a few years</Text>
                                                        </Box>
                                                    </Flex>
                                                </Box>
                                            </Card>

                                            {/* Advanced Level */}
                                            <Card
                                                style={{
                                                    background: positionLevel === 'advanced' ? 'var(--purple-2)' : 'var(--gray-1)',
                                                    border: `2px solid ${positionLevel === 'advanced' ? 'var(--purple-7)' : 'var(--gray-6)'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => setPositionLevel('advanced')}
                                            >
                                                <Box p="4">
                                                    <Flex align="center" gap="3">
                                                        <Box style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            border: `2px solid ${positionLevel === 'advanced' ? 'var(--purple-9)' : 'var(--gray-6)'}`,
                                                            background: positionLevel === 'advanced' ? 'var(--purple-9)' : 'transparent',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {positionLevel === 'advanced' && (
                                                                <CheckIcon width="12" height="12" color="white" />
                                                            )}
                                                        </Box>
                                                        <Box>
                                                            <Text size="3" weight="bold">Advanced: </Text>
                                                            <Text size="2" color="gray">Many years of experience, likely a senior professional or leadership role</Text>
                                                        </Box>
                                                    </Flex>
                                                </Box>
                                            </Card>
                                        </Flex>
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

                    {/* Step 4: Resume Upload */}
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
                                            <Text size="4" weight="bold">Candidate Resume</Text>
                                            {isStepComplete(4) && (
                                                <Badge size="1" variant="soft" color="green">Complete</Badge>
                                            )}
                                        </Flex>

                                        <Box
                                            style={{
                                                border: `2px dashed ${isStepComplete(4) ? 'var(--green-7)' : 'var(--gray-6)'}`,
                                                borderRadius: '8px',
                                                padding: '24px',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                background: isStepComplete(4) ? 'var(--green-1)' : 'var(--gray-1)',
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