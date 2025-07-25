/**
 * NewOffboarding.tsx
 * Employee Offboarding training setup page for LearnLoop.
 * @AshokSaravanan222 & @siladiea
 * 2025-01-15
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
import { PersonIcon, PlayIcon, CheckIcon, ArrowLeftIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';
import { InterviewType } from '@/types';
import { logError } from '@/utils/logger';
import Link from 'next/link';

type OffboardingType = 'voluntary' | 'involuntary' | 'layoff' | 'retirement';
type EmployeeLevel = 'junior' | 'mid' | 'senior' | 'executive';

export default function NewOffboarding() {
    const router = useRouter();
    const [employeeName, setEmployeeName] = useState('');
    const [employeeRole, setEmployeeRole] = useState('');
    const [offboardingType, setOffboardingType] = useState<OffboardingType | ''>('');
    const [employeeLevel, setEmployeeLevel] = useState<EmployeeLevel | ''>('');
    const [isLoading, setIsLoading] = useState(false);

    const startOffboarding = async () => {
        if (!employeeName.trim() || !employeeRole.trim() || !offboardingType || !employeeLevel) {
            alert('Please complete all steps before starting the offboarding training');
            return;
        }

        setIsLoading(true);

        try {
            // For offboarding, we'll use a regular type but modify the context
            const dbInterviewType: InterviewType = 'regular';

            const formData = new FormData();
            formData.append('name', employeeName);
            formData.append('position', employeeRole);
            formData.append('type', dbInterviewType);
            formData.append('training_type', 'offboarding'); // New field to distinguish training type
            formData.append('offboarding_type', offboardingType);
            formData.append('employee_level', employeeLevel);

            const response = await fetch('/api/chat/start', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                router.push(`/interview/c/${data.chatId}`);
            } else {
                throw new Error(data.error || 'Failed to start offboarding training');
            }
        } catch (error) {
            logError('Error starting offboarding training:', error instanceof Error ? error.message : 'Unknown error');
            alert('Failed to start offboarding training. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const isStepComplete = (step: number) => {
        switch (step) {
            case 1: return employeeName.trim() !== '';
            case 2: return employeeRole.trim() !== '';
            case 3: return offboardingType !== '';
            case 4: return employeeLevel !== '';
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
                        <Badge size="2" variant="soft" color="orange">
                            Employee Offboarding Training
                        </Badge>
                    </Flex>
                </Container>
            </Box>

            {/* Back Button */}
            <Container size="4" pt="4">
                <Link href="/dashboard/trainings">
                    <Button variant="ghost" size="2" style={{ color: 'black' }}>
                        <ArrowLeftIcon width="16" height="16" />
                        Back to Training Dashboard
                    </Button>
                </Link>
            </Container>

            {/* Main Content */}
            <Container size="4" py="8">
                {/* Hero Section */}
                <Box mb="10" style={{ textAlign: 'center' }}>
                    <Heading size="9" weight="bold" mb="4">
                        Employee Offboarding Training
                    </Heading>
                    <Text size="4" color="gray">
                        Practice conducting professional and empathetic employee departures
                    </Text>
                </Box>

                {/* Step Cards with Progress Bars */}
                <Box maxWidth="800px" mx="auto">
                    {/* Step 1: Employee Name */}
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
                                            <Text size="4" weight="bold">Employee Information</Text>
                                            {isStepComplete(1) && (
                                                <Badge size="1" variant="soft" color="green">Complete</Badge>
                                            )}
                                        </Flex>

                                        <input
                                            type="text"
                                            placeholder="Enter employee's full name"
                                            value={employeeName}
                                            onChange={(e) => setEmployeeName(e.target.value)}
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

                    {/* Step 2: Employee Role */}
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
                                            <Text size="4" weight="bold">Employee Role</Text>
                                            {isStepComplete(2) && (
                                                <Badge size="1" variant="soft" color="green">Complete</Badge>
                                            )}
                                        </Flex>

                                        <input
                                            type="text"
                                            placeholder="e.g., Marketing Manager, Software Engineer, Sales Representative"
                                            value={employeeRole}
                                            onChange={(e) => setEmployeeRole(e.target.value)}
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

                    {/* Step 3: Offboarding Type */}
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
                                            <Text size="4" weight="bold">Offboarding Scenario</Text>
                                            {isStepComplete(3) && (
                                                <Badge size="1" variant="soft" color="green">Complete</Badge>
                                            )}
                                        </Flex>

                                        <Flex direction="column" gap="3">
                                            {/* Voluntary Departure */}
                                            <Card
                                                style={{
                                                    background: offboardingType === 'voluntary' ? 'var(--green-2)' : 'var(--gray-1)',
                                                    border: `2px solid ${offboardingType === 'voluntary' ? 'var(--green-7)' : 'var(--gray-6)'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => setOffboardingType('voluntary')}
                                            >
                                                <Box p="4">
                                                    <Flex align="center" gap="3">
                                                        <Box style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            border: `2px solid ${offboardingType === 'voluntary' ? 'var(--green-9)' : 'var(--gray-6)'}`,
                                                            background: offboardingType === 'voluntary' ? 'var(--green-9)' : 'transparent',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {offboardingType === 'voluntary' && (
                                                                <CheckIcon width="12" height="12" color="white" />
                                                            )}
                                                        </Box>
                                                        <Box>
                                                            <Text size="3" weight="bold">Voluntary Departure: </Text>
                                                            <Text size="2" color="gray">Employee is leaving for new opportunities or personal reasons</Text>
                                                        </Box>
                                                    </Flex>
                                                </Box>
                                            </Card>

                                            {/* Involuntary Termination */}
                                            <Card
                                                style={{
                                                    background: offboardingType === 'involuntary' ? 'var(--red-2)' : 'var(--gray-1)',
                                                    border: `2px solid ${offboardingType === 'involuntary' ? 'var(--red-7)' : 'var(--gray-6)'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => setOffboardingType('involuntary')}
                                            >
                                                <Box p="4">
                                                    <Flex align="center" gap="3">
                                                        <Box style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            border: `2px solid ${offboardingType === 'involuntary' ? 'var(--red-9)' : 'var(--gray-6)'}`,
                                                            background: offboardingType === 'involuntary' ? 'var(--red-9)' : 'transparent',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {offboardingType === 'involuntary' && (
                                                                <CheckIcon width="12" height="12" color="white" />
                                                            )}
                                                        </Box>
                                                        <Box>
                                                            <Text size="3" weight="bold">Involuntary Termination: </Text>
                                                            <Text size="2" color="gray">Employee is being terminated due to performance or conduct issues</Text>
                                                        </Box>
                                                    </Flex>
                                                </Box>
                                            </Card>

                                            {/* Layoff */}
                                            <Card
                                                style={{
                                                    background: offboardingType === 'layoff' ? 'var(--orange-2)' : 'var(--gray-1)',
                                                    border: `2px solid ${offboardingType === 'layoff' ? 'var(--orange-7)' : 'var(--gray-6)'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => setOffboardingType('layoff')}
                                            >
                                                <Box p="4">
                                                    <Flex align="center" gap="3">
                                                        <Box style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            border: `2px solid ${offboardingType === 'layoff' ? 'var(--orange-9)' : 'var(--gray-6)'}`,
                                                            background: offboardingType === 'layoff' ? 'var(--orange-9)' : 'transparent',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {offboardingType === 'layoff' && (
                                                                <CheckIcon width="12" height="12" color="white" />
                                                            )}
                                                        </Box>
                                                        <Box>
                                                            <Text size="3" weight="bold">Layoff: </Text>
                                                            <Text size="2" color="gray">Employee is being laid off due to business restructuring or economic reasons</Text>
                                                        </Box>
                                                    </Flex>
                                                </Box>
                                            </Card>

                                            {/* Retirement */}
                                            <Card
                                                style={{
                                                    background: offboardingType === 'retirement' ? 'var(--blue-2)' : 'var(--gray-1)',
                                                    border: `2px solid ${offboardingType === 'retirement' ? 'var(--blue-7)' : 'var(--gray-6)'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => setOffboardingType('retirement')}
                                            >
                                                <Box p="4">
                                                    <Flex align="center" gap="3">
                                                        <Box style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            border: `2px solid ${offboardingType === 'retirement' ? 'var(--blue-9)' : 'var(--gray-6)'}`,
                                                            background: offboardingType === 'retirement' ? 'var(--blue-9)' : 'transparent',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {offboardingType === 'retirement' && (
                                                                <CheckIcon width="12" height="12" color="white" />
                                                            )}
                                                        </Box>
                                                        <Box>
                                                            <Text size="3" weight="bold">Retirement: </Text>
                                                            <Text size="2" color="gray">Long-term employee is retiring after years of service</Text>
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

                    {/* Step 4: Employee Level */}
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
                                            <Text size="4" weight="bold">Employee Level</Text>
                                            {isStepComplete(4) && (
                                                <Badge size="1" variant="soft" color="green">Complete</Badge>
                                            )}
                                        </Flex>

                                        <Flex direction="column" gap="3">
                                            {/* Junior Level */}
                                            <Card
                                                style={{
                                                    background: employeeLevel === 'junior' ? 'var(--green-2)' : 'var(--gray-1)',
                                                    border: `2px solid ${employeeLevel === 'junior' ? 'var(--green-7)' : 'var(--gray-6)'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => setEmployeeLevel('junior')}
                                            >
                                                <Box p="4">
                                                    <Flex align="center" gap="3">
                                                        <Box style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            border: `2px solid ${employeeLevel === 'junior' ? 'var(--green-9)' : 'var(--gray-6)'}`,
                                                            background: employeeLevel === 'junior' ? 'var(--green-9)' : 'transparent',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {employeeLevel === 'junior' && (
                                                                <CheckIcon width="12" height="12" color="white" />
                                                            )}
                                                        </Box>
                                                        <Box>
                                                            <Text size="3" weight="bold">Junior: </Text>
                                                            <Text size="2" color="gray">New employee or individual contributor (0-3 years)</Text>
                                                        </Box>
                                                    </Flex>
                                                </Box>
                                            </Card>

                                            {/* Mid Level */}
                                            <Card
                                                style={{
                                                    background: employeeLevel === 'mid' ? 'var(--blue-2)' : 'var(--gray-1)',
                                                    border: `2px solid ${employeeLevel === 'mid' ? 'var(--blue-7)' : 'var(--gray-6)'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => setEmployeeLevel('mid')}
                                            >
                                                <Box p="4">
                                                    <Flex align="center" gap="3">
                                                        <Box style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            border: `2px solid ${employeeLevel === 'mid' ? 'var(--blue-9)' : 'var(--gray-6)'}`,
                                                            background: employeeLevel === 'mid' ? 'var(--blue-9)' : 'transparent',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {employeeLevel === 'mid' && (
                                                                <CheckIcon width="12" height="12" color="white" />
                                                            )}
                                                        </Box>
                                                        <Box>
                                                            <Text size="3" weight="bold">Mid-Level: </Text>
                                                            <Text size="2" color="gray">Experienced team member or specialist (3-7 years)</Text>
                                                        </Box>
                                                    </Flex>
                                                </Box>
                                            </Card>

                                            {/* Senior Level */}
                                            <Card
                                                style={{
                                                    background: employeeLevel === 'senior' ? 'var(--purple-2)' : 'var(--gray-1)',
                                                    border: `2px solid ${employeeLevel === 'senior' ? 'var(--purple-7)' : 'var(--gray-6)'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => setEmployeeLevel('senior')}
                                            >
                                                <Box p="4">
                                                    <Flex align="center" gap="3">
                                                        <Box style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            border: `2px solid ${employeeLevel === 'senior' ? 'var(--purple-9)' : 'var(--gray-6)'}`,
                                                            background: employeeLevel === 'senior' ? 'var(--purple-9)' : 'transparent',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {employeeLevel === 'senior' && (
                                                                <CheckIcon width="12" height="12" color="white" />
                                                            )}
                                                        </Box>
                                                        <Box>
                                                            <Text size="3" weight="bold">Senior: </Text>
                                                            <Text size="2" color="gray">Senior professional or team lead (7+ years)</Text>
                                                        </Box>
                                                    </Flex>
                                                </Box>
                                            </Card>

                                            {/* Executive Level */}
                                            <Card
                                                style={{
                                                    background: employeeLevel === 'executive' ? 'var(--gold-2)' : 'var(--gray-1)',
                                                    border: `2px solid ${employeeLevel === 'executive' ? 'var(--gold-7)' : 'var(--gray-6)'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => setEmployeeLevel('executive')}
                                            >
                                                <Box p="4">
                                                    <Flex align="center" gap="3">
                                                        <Box style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            border: `2px solid ${employeeLevel === 'executive' ? 'var(--gold-9)' : 'var(--gray-6)'}`,
                                                            background: employeeLevel === 'executive' ? 'var(--gold-9)' : 'transparent',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {employeeLevel === 'executive' && (
                                                                <CheckIcon width="12" height="12" color="white" />
                                                            )}
                                                        </Box>
                                                        <Box>
                                                            <Text size="3" weight="bold">Executive: </Text>
                                                            <Text size="2" color="gray">Director, VP, or C-level executive</Text>
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

                    {/* Progress Bar 4 */}
                    <Flex justify="center" mb="4">
                        <Box style={{
                            width: '2px',
                            height: '24px',
                            background: allStepsComplete ? 'var(--green-8)' : 'var(--gray-6)',
                            borderRadius: '2px'
                        }} />
                    </Flex>

                    {/* Step 5: Start Training */}
                    <Box>
                        <Card style={{
                            background: allStepsComplete ? 'white' : 'var(--gray-2)',
                            border: `1px solid ${allStepsComplete ? 'var(--orange-7)' : 'var(--gray-6)'}`,
                            borderRadius: '12px',
                            boxShadow: allStepsComplete ? '0 4px 12px rgba(255, 140, 0, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                            transition: 'all 0.2s ease'
                        }}>
                            <Box p="6">
                                <Flex align="center" gap="4">
                                    <Box style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: allStepsComplete ? 'var(--orange-9)' : 'var(--gray-7)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <PlayIcon color="white" width="16" height="16" />
                                    </Box>
                                    <Box style={{ flex: 1 }}>
                                        <Flex align="center" gap="2" mb="3">
                                            <Text size="4" weight="bold">Start Offboarding Training</Text>
                                            {allStepsComplete && (
                                                <Badge size="1" variant="soft" color="orange">Ready to start</Badge>
                                            )}
                                        </Flex>

                                        <Button
                                            size="3"
                                            onClick={startOffboarding}
                                            disabled={!allStepsComplete || isLoading}
                                            style={{
                                                width: '100%',
                                                background: allStepsComplete ? 'var(--orange-9)' : 'var(--gray-6)',
                                                opacity: allStepsComplete ? 1 : 0.6,
                                                cursor: allStepsComplete ? 'pointer' : 'not-allowed'
                                            }}
                                        >
                                            {isLoading ? (
                                                <Flex align="center" gap="2">
                                                    <Spinner size="2" />
                                                    <Text>Starting Training...</Text>
                                                </Flex>
                                            ) : (
                                                <Flex align="center" gap="2">
                                                    <PlayIcon />
                                                    <Text>Start Training</Text>
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