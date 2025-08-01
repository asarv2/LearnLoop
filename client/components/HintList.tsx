'use client';
import {
  useHints,
  useCreateHint,
  useDeleteHint,
} from '@/lib/api/hooks/useHints';

export default function HintList() {
  const { data, isLoading } = useHints();
  const create = useCreateHint();
  const del = useDeleteHint('');

  if (isLoading) return <p>Loading…</p>;

  return (
    <div className="p-4">
      <button
        onClick={() =>
          create.mutate({
            contents: ['Sample hint content'],
            message_id: null,
          })
        }
        disabled={create.isPending}
        className="mb-4 px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 disabled:opacity-50"
      >
        {create.isPending ? 'Creating...' : '+ New Hint'}
      </button>

      <ul className="space-y-2">
        {data?.map((hint) => (
          <li key={hint.id} className="flex items-center justify-between p-3 border rounded">
            <div>
              <span className="font-medium">Hint {hint.id}</span>
              <div className="text-sm text-gray-500">
                {hint.contents?.length || 0} content items
                {hint.message_id && ` • Message: ${hint.message_id}`}
              </div>
              {hint.contents && hint.contents.length > 0 && (
                <div className="text-sm text-gray-400 mt-1">
                  {hint.contents[0]}
                  {hint.contents.length > 1 && ` +${hint.contents.length - 1} more`}
                </div>
              )}
            </div>
            <button 
              onClick={() => del.mutate(hint.id)}
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