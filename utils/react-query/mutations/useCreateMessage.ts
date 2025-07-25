import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createMessage } from '@/utils/mutations/messages/create-message';
import type { Message } from '@/types';
import type { TablesInsert } from '@/database.types';

/**
 * Optimistic mutation hook for creating messages
 * Eliminates flash by patching the cache instead of invalidating it
 */
export const useCreateMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMessage,
    
    // Optimistic update
    onMutate: async (draft: Omit<TablesInsert<'messages'>, 'id' | 'created_at'>) => {
      const chatId = draft.chat_id;
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messages', chatId] });
      
      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<Message[]>(['messages', chatId]) ?? [];

      // Create optimistic message
      const optimisticMessage: Message = {
        ...draft,
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`, // Stable during round-trip
        created_at: new Date().toISOString(),
        completed: true,
        completed_at: new Date().toISOString(),
        training_id: null,
        content: draft.content ?? null, // Ensure content is never undefined
      };

      // Optimistically update to the new value
      queryClient.setQueryData<Message[]>(['messages', chatId], [...previousMessages, optimisticMessage]);

      // Return a context object with the snapshotted value
      return { 
        previousMessages, 
        optimisticId: optimisticMessage.id,
        chatId
      };
    },

    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (_err, _draft, context) => {
      if (context?.previousMessages && context?.chatId) {
        queryClient.setQueryData(['messages', context.chatId], context.previousMessages);
      }
    },

    // Replace optimistic message with real one on success
    onSuccess: (savedMessage, _draft, context) => {
      if (context?.chatId) {
        queryClient.setQueryData<Message[]>(['messages', context.chatId], (old) => {
          if (!old) return [savedMessage];
          return old.map((message) => 
            message.id === context?.optimisticId ? savedMessage : message
          );
        });
      }
    },
  });
}; 