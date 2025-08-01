'use client';
import {
  useAttempts,
  useCreateAttempt,
  useDeleteAttempt,
} from '@/lib/api/hooks/useAttempts';

export default function AttemptList() {
  const { data, isLoading } = useAttempts();
  const create = useCreateAttempt();
  const del = useDeleteAttempt('');

  if (isLoading) return <p>Loading…</p>;

  return (
    <div className="p-4">
      <button
        onClick={() =>
          create.mutate({
            profile_id: null,
            training_id: null,
          })
        }
        disabled={create.isPending}
        className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
      >
        {create.isPending ? 'Creating...' : '+ New Attempt'}
      </button>

      <ul className="space-y-2">
        {data?.map((attempt) => (
          <li key={attempt.id} className="flex items-center justify-between p-3 border rounded">
            <span>Attempt {attempt.id}</span>
            <button 
              onClick={() => del.mutate(attempt.id)}
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