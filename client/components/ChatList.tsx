'use client';
import {
  useChats,
  useCreateChat,
  useDeleteChat,
} from '@/lib/api/hooks/useChats';

export default function ChatList() {
  const { data, isLoading } = useChats();
  const create = useCreateChat();
  const del = useDeleteChat('');

  if (isLoading) return <p>Loading…</p>;

  return (
    <div className="p-4">
      <button
        onClick={() =>
          create.mutate({
            title: 'New Chat',
            type: 'regular',
            name: 'Interview Chat',
            position: 'Software Engineer',
            voice: 'en-US',
          })
        }
        disabled={create.isPending}
        className="mb-4 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
      >
        {create.isPending ? 'Creating...' : '+ New Chat'}
      </button>

      <ul className="space-y-2">
        {data?.map((chat) => (
          <li key={chat.id} className="flex items-center justify-between p-3 border rounded">
            <div>
              <span className="font-medium">{chat.title}</span>
              <span className="text-sm text-gray-500 ml-2">({chat.type})</span>
            </div>
            <button 
              onClick={() => del.mutate(chat.id)}
              disabled={del.isPending}
              className="px-2 py-1 text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              🗑️
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
} 