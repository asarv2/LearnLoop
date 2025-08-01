'use client';
import {
  useFeedback,
  useCreateFeedback,
  useDeleteFeedback,
} from '@/lib/api/hooks/useFeedback';

export default function FeedbackList() {
  const { data, isLoading } = useFeedback();
  const create = useCreateFeedback();
  const del = useDeleteFeedback('');

  if (isLoading) return <p>Loading…</p>;

  return (
    <div className="p-4">
      <button
        onClick={() =>
          create.mutate({
            chat_id: 'chat-123',
            errors: ['Sample error'],
            green_flags: ['Good communication'],
            red_flags: ['Needs improvement'],
            strengths: ['Technical knowledge'],
            weaknesses: null,
            training_id: null,
          })
        }
        disabled={create.isPending}
        className="mb-4 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
      >
        {create.isPending ? 'Creating...' : '+ New Feedback'}
      </button>

      <ul className="space-y-2">
        {data?.map((feedback) => (
          <li key={feedback.id} className="flex items-center justify-between p-3 border rounded">
            <div>
              <span className="font-medium">Feedback for Chat {feedback.chat_id}</span>
              <div className="text-sm text-gray-500">
                {feedback.strengths?.length || 0} strengths, {feedback.errors?.length || 0} errors
              </div>
            </div>
            <button 
              onClick={() => del.mutate(feedback.id)}
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