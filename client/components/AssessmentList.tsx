'use client';
import {
  useAssessments,
  useCreateAssessment,
  useDeleteAssessment,
} from '@/lib/api/hooks/useAssessments';

export default function AssessmentList() {
  const { data, isLoading } = useAssessments();
  const create = useCreateAssessment();
  const del = useDeleteAssessment('');

  if (isLoading) return <p>Loading…</p>;

  return (
    <div className="p-4">
      <button
        onClick={() =>
          create.mutate({
            chat_id: 'abc-123',
            title: 'New quiz',
            responses: null,
            training_id: null,
          })
        }
        disabled={create.isPending}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {create.isPending ? 'Creating...' : '+ New Assessment'}
      </button>

      <ul className="space-y-2">
        {data?.map((assessment) => (
          <li key={assessment.id} className="flex items-center justify-between p-3 border rounded">
            <span>{assessment.title || 'Untitled Assessment'}</span>
            <button 
              onClick={() => del.mutate(assessment.id)}
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