/**
 * InterviewHomepage.tsx
 * @AshokSaravanan222 & @siladiea
 * Used to show all of the interviews that have happened
 * 2025-07-09
 */
"use client";

import { getChats } from "@/utils/queries/chats/get-all-chats";
import { 
    Button, 
    Box, 
    Flex, 
    Heading, 
    Text, 
    Card, 
    Container, 
    Badge,
    Grid
} from "@radix-ui/themes";
import { 
    PlayIcon, 
    PlusIcon, 
    CalendarIcon, 
    PersonIcon,
    FileTextIcon,
    ChatBubbleIcon,
    ChevronLeftIcon,
    ChevronRightIcon
} from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Chat } from "@/types";
import { useState } from "react";

const CHATS_PER_PAGE = 9;

export default function InterviewHomepage() {
    const [currentPage, setCurrentPage] = useState(1);
    
    const { data: chats, isLoading } = useQuery({
        queryKey: ['chats'],
        queryFn: () => getChats(),
    });

    // Sort chats by newest first and paginate
    const sortedChats = chats?.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ) || [];
    
    const totalPages = Math.ceil(sortedChats.length / CHATS_PER_PAGE);
    const startIndex = (currentPage - 1) * CHATS_PER_PAGE;
    const endIndex = startIndex + CHATS_PER_PAGE;
    const paginatedChats = sortedChats.slice(startIndex, endIndex);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (chat: Chat) => {
        if (chat.completed_at) {
            return <Badge size="1" variant="soft" color="green">Completed</Badge>;
        }
        return <Badge size="1" variant="soft" color="blue">In Progress</Badge>;
    };

    const getCandidateTypeBadge = (type: string) => {
        switch (type) {
            case 'regular':
                return <Badge size="1" variant="soft" color="blue">Regular</Badge>;
            case 'ai-assisted':
                return <Badge size="1" variant="soft" color="amber">AI-Assisted</Badge>;
            case 'random':
                return <Badge size="1" variant="soft" color="purple">Random</Badge>;
            default:
                return <Badge size="1" variant="soft" color="gray">{type}</Badge>;
        }
    };

    const goToNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const goToPreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

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
                        
                        <Flex align="center" gap="4">
                            <Badge size="2" variant="soft" color="blue">
                                Interview Dashboard
                            </Badge>
                            <Button size="3" asChild>
                                <Link href="/interview/new">
                                    <PlusIcon />
                                    Start New Interview
                                </Link>
                            </Button>
                        </Flex>
                    </Flex>
                </Container>
            </Box>

            {/* Main Content */}
            <Container size="4" py="8">
                {/* Hero Section */}
                <Box mb="8" style={{ textAlign: 'center' }}>
                    <Heading size="8" weight="bold" mb="4">
                        Your Interview Sessions
                    </Heading>
                    <Text size="4" color="gray" mb="6" style={{ lineHeight: '1.6', maxWidth: '600px', margin: '0 auto 24px auto' }}>
                        Track your interview training progress and review past sessions
                    </Text>
                    
                    {/* Stats */}
                    {sortedChats.length > 0 && (
                        <Flex justify="center" gap="6" mb="6">
                            <Box style={{ textAlign: 'center' }}>
                                <Text size="6" weight="bold" style={{ color: 'var(--blue-11)' }}>
                                    {sortedChats.length}
                                </Text>
                                <Text size="2" color="gray">
                                    Total Interviews
                                </Text>
                            </Box>
                            <Box style={{ textAlign: 'center' }}>
                                <Text size="6" weight="bold" style={{ color: 'var(--green-11)' }}>
                                    {sortedChats.filter(chat => chat.completed_at).length}
                                </Text>
                                <Text size="2" color="gray">
                                    Completed
                                </Text>
                            </Box>
                        </Flex>
                    )}
                </Box>

                {/* Interviews Grid */}
                {isLoading ? (
                    <Box style={{ textAlign: 'center' }} py="8">
                        <Text size="4" color="gray">Loading interviews...</Text>
                    </Box>
                ) : sortedChats.length > 0 ? (
                    <>
                        <Grid columns={{ initial: '1', md: '2', lg: '3' }} gap="6" mb="8">
                            {paginatedChats.map((chat) => (
                                <Card
                                    key={chat.id}
                                    style={{
                                        background: 'white',
                                        border: '1px solid var(--gray-6)',
                                        borderRadius: '12px',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                        transition: 'all 0.2s ease',
                                        cursor: 'pointer'
                                    }}
                                    asChild
                                >
                                    <Link href={`/interview/c/${chat.id}`}>
                                        <Box p="6">
                                            {/* Header */}
                                            <Flex justify="between" align="start" mb="4">
                                                <Box style={{ flex: 1 }}>
                                                    <Heading size="4" mb="2" style={{ 
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {chat.title || 'Untitled Interview'}
                                                    </Heading>
                                                    <Flex gap="2" mb="2">
                                                        {getStatusBadge(chat)}
                                                        {getCandidateTypeBadge(chat.type)}
                                                    </Flex>
                                                </Box>
                                                <PlayIcon width="20" height="20" color="var(--gray-9)" />
                                            </Flex>

                                            {/* Candidate Info */}
                                            <Box mb="4">
                                                <Flex align="center" gap="2" mb="2">
                                                    <PersonIcon width="16" height="16" color="var(--gray-9)" />
                                                    <Text size="3" weight="medium">
                                                        {chat.name || 'Unknown Candidate'}
                                                    </Text>
                                                </Flex>
                                                <Flex align="center" gap="2" mb="2">
                                                    <FileTextIcon width="16" height="16" color="var(--gray-9)" />
                                                    <Text size="2" color="gray">
                                                        {chat.position || 'No position specified'}
                                                    </Text>
                                                </Flex>
                                            </Box>

                                            {/* Additional Info */}
                                            {chat.additional_info && (
                                                <Box mb="4">
                                                    <Text size="2" color="gray" style={{
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden'
                                                    }}>
                                                        {chat.additional_info}
                                                    </Text>
                                                </Box>
                                            )}

                                            {/* Timestamps */}
                                            <Box>
                                                <Flex align="center" gap="2" mb="1">
                                                    <CalendarIcon width="14" height="14" color="var(--gray-8)" />
                                                    <Text size="1" color="gray">
                                                        Started: {formatDate(chat.created_at)}
                                                    </Text>
                                                </Flex>
                                                {chat.completed_at && (
                                                    <Flex align="center" gap="2">
                                                        <ChatBubbleIcon width="14" height="14" color="var(--gray-8)" />
                                                        <Text size="1" color="gray">
                                                            Completed: {formatDate(chat.completed_at)}
                                                        </Text>
                                                    </Flex>
                                                )}
                                            </Box>
                                        </Box>
                                    </Link>
                                </Card>
                            ))}
                        </Grid>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <Flex justify="center" align="center" gap="4">
                                <Button
                                    variant="outline"
                                    size="2"
                                    onClick={goToPreviousPage}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeftIcon />
                                    Previous
                                </Button>
                                
                                <Flex align="center" gap="2">
                                    <Text size="2" color="gray">
                                        Page {currentPage} of {totalPages}
                                    </Text>
                                </Flex>
                                
                                <Button
                                    variant="outline"
                                    size="2"
                                    onClick={goToNextPage}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                    <ChevronRightIcon />
                                </Button>
                            </Flex>
                        )}
                    </>
                ) : (
                    <Box style={{ textAlign: 'center' }} py="12">
                        <Box style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'var(--gray-3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px'
                        }}>
                            <ChatBubbleIcon width="32" height="32" color="var(--gray-8)" />
                        </Box>
                        <Heading size="6" mb="3">No interviews yet</Heading>
                        <Text size="3" color="gray" mb="6" style={{ maxWidth: '400px', margin: '0 auto 24px auto' }}>
                            Start your first interview training session to begin improving your interviewing skills
                        </Text>
                        <Button size="3" asChild>
                            <Link href="/interview/new">
                                <PlusIcon />
                                Start Your First Interview
                            </Link>
                        </Button>
                    </Box>
                )}
            </Container>
        </Box>
    );
}