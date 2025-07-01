/**
 * ChatPage.tsx
 * Shows the chat page along with results.
 * @AshokSaravanan222 & @siladiea
 */
"use client";
import { getChats } from "@/utils/queries/chats/get-all-chats";
import { getMessages } from "@/utils/queries/messages/get-all-messages";
import { Box, Card, Text, Strong, Heading } from "@radix-ui/themes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Chat, Message } from "@/types";
import { useState } from "react";

export default function ChatPage() {
    const queryClient = useQueryClient();
    const [selectedChatId, setSelectedChatId] = useState<string>("");
    const [messageInput, setMessageInput] = useState<string>("");

    const { data: chats, isLoading: chatsLoading, error: chatsError } = useQuery({
        queryKey: ["chats"],
        queryFn: () => getChats(),
    });

    const { data: messages, isLoading: messagesLoading, error: messagesError } = useQuery({
        queryKey: ["messages"],
        queryFn: () => getMessages(),
    });

    const startChatMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch("/api/chat/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (!response.ok) throw new Error("Failed to start chat");
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["chats"] });
        },
    });

    const sendMessageMutation = useMutation({
        mutationFn: async ({ chatId, message }: { chatId: string; message: string }) => {
            const formData = new FormData();
            formData.append("chatId", chatId);
            formData.append("message", message);
            formData.append("role", "user");
            const response = await fetch("/api/chat/message", {
                method: "POST",
                body: formData,
            });
            if (!response.ok) throw new Error("Failed to send message");
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["messages"] });
        },
    });

    return (
            <Box maxWidth="600px" mx="auto" mt="6">
                <Heading size="6" mb="4">Learn Loop</Heading>
                <Card size="3" mb="4">
                    <Text as="p" size="5" mb="2">
                        <Strong>Chats</Strong>
                    </Text>
                    <button onClick={() => startChatMutation.mutate()} disabled={startChatMutation.isPending} style={{ marginBottom: 8 }}>
                        {startChatMutation.isPending ? "Creating..." : "Create New Chat"}
                    </button>
                    {chatsLoading && <Text>Loading chats...</Text>}
                    {chatsError && <Text color="red">Failed to load chats.</Text>}
                    {!chatsLoading && !chatsError && (
                        <Box as="div" pl="4">
                            {Array.isArray(chats) && chats.length > 0 ? (
                                chats.map((chat: Chat) => (
                                    <Box as="div" key={chat.id} mb="2">
                                        <Card size="1" variant="surface" style={{ cursor: "pointer", border: selectedChatId === chat.id ? "2px solid #888" : undefined }} onClick={() => setSelectedChatId(chat.id)}>
                                            <Text>
                                                <Strong>ID:</Strong> {chat.id}
                                            </Text>
                                            {chat.title && (
                                                <Text ml="2">
                                                    <Strong>Title:</Strong> {chat.title}
                                                </Text>
                                            )}
                                            {selectedChatId === chat.id && <Text ml="2" color="green">(Selected)</Text>}
                                        </Card>
                                    </Box>
                                ))
                            ) : (
                                <Text>No chats found.</Text>
                            )}
                        </Box>
                    )}
                </Card>
                <Card size="3" mb="4">
                    <Text as="p" size="5" mb="2">
                        <Strong>Send Message</Strong>
                    </Text>
                    <input
                        type="text"
                        placeholder="Type a message..."
                        value={messageInput}
                        onChange={e => setMessageInput(e.target.value)}
                        style={{ width: "80%", marginRight: 8 }}
                        disabled={!selectedChatId}
                    />
                    <button
                        onClick={() => {
                            if (selectedChatId && messageInput) {
                                sendMessageMutation.mutate({ chatId: selectedChatId, message: messageInput });
                                setMessageInput("");
                            }
                        }}
                        disabled={!selectedChatId || !messageInput || sendMessageMutation.isPending}
                    >
                        {sendMessageMutation.isPending ? "Sending..." : "Send"}
                    </button>
                    {!selectedChatId && <Text color="gray" ml="2">Select a chat to send a message</Text>}
                </Card>
                <Card size="3">
                    <Text as="p" size="5" mb="2">
                        <Strong>Messages</Strong>
                    </Text>
                    {messagesLoading && <Text>Loading messages...</Text>}
                    {messagesError && <Text color="red">Failed to load messages.</Text>}
                    {!messagesLoading && !messagesError && (
                        <Box as="div" pl="4">
                            {Array.isArray(messages) && messages.length > 0 ? (
                                messages.map((message: Message) => (
                                    <Box as="div" key={message.id} mb="2">
                                        <Card size="1" variant="surface">
                                            <Text>
                                                <Strong>Chat ID:</Strong> {message.chat_id}
                                            </Text>
                                            <Text ml="2">
                                                <Strong>Content:</Strong> {message.content}
                                            </Text>
                                        </Card>
                                    </Box>
                                ))
                            ) : (
                                <Text>No messages found.</Text>
                            )}
                        </Box>
                    )}
                </Card>
            </Box>
    );
}