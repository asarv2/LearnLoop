/**
 * ChatArea.tsx
 * Used for text to text interactions.
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

import {
    Box,
    Flex,
    Text,
    Button,
    Card,
    Spinner
} from '@radix-ui/themes';
import { PaperPlaneIcon, PersonIcon, ChatBubbleIcon } from '@radix-ui/react-icons';
import { Chat, Message } from '@/types';

interface ChatAreaProps {
    displayMessages: Message[];
    isLoading: boolean;
    streamingMessage: boolean;
    isInterviewActive: boolean;
    showFeedback: boolean;
    currentMessage: string;
    setCurrentMessage: (message: string) => void;
    handleKeyPress: (e: React.KeyboardEvent) => void;
    sendMessage: () => void;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    chat: Chat;
}

export default function ChatArea({ displayMessages, isLoading, streamingMessage, isInterviewActive, showFeedback, currentMessage, setCurrentMessage, handleKeyPress, sendMessage, messagesEndRef, chat }: ChatAreaProps) {
    return (
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
                    {displayMessages.map((message) => (
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
                                                {message.role === 'user' ? '' : chat?.name || 'John Doe'}
                                            </Text>
                                            <Text size="2" style={{ lineHeight: '1.5', color: 'var(--gray-12)' }}>
                                                {message.role === 'assistant' && !message.completed && !message.content
                                                    ? `${chat?.name || 'John Doe'} is thinking...`
                                                    : message.role === 'assistant' && message.completed && !message.content
                                                        ? 'No response'
                                                        : message.content
                                                }
                                                {message.role === 'assistant' && !message.completed && message.content && (
                                                    <span style={{ opacity: 0.7 }}>▊</span>
                                                )}
                                            </Text>
                                            <Text size="1" style={{ color: 'var(--gray-11)' }}>
                                                {new Date(message.created_at).toLocaleTimeString()}
                                            </Text>
                                        </Flex>
                                    </Card>
                                </Box>
                            </Flex>
                        </Box>
                    ))}

                    {isLoading && !streamingMessage && (
                        <Flex align="center" gap="2" justify="start">
                            <Card size="1" style={{ padding: '8px', background: 'var(--green-3)' }}>
                                <ChatBubbleIcon color="var(--green-9)" />
                            </Card>
                            <Card size="2" style={{ background: 'var(--gray-2)', border: '1px solid var(--gray-7)' }}>
                                <Flex align="center" gap="2" p="3">
                                    <Spinner size="1" />
                                    <Text size="2" style={{ color: 'var(--gray-11)' }}>
                                        {chat?.name || 'John Doe'} is thinking...
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
    )
}