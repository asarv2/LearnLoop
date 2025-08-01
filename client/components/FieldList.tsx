'use client';
import {
  useFields,
  useCreateField,
  useDeleteField,
} from '@/lib/api/hooks/useFields';

export default function FieldList() {
  const { data, isLoading } = useFields();
  const create = useCreateField();
  const del = useDeleteField('');

  if (isLoading) return <p>Loading…</p>;

  return (
    <div className="p-4">
      <button
        onClick={() =>
          create.mutate({
            name: 'New Field',
            field_type: 'text',
            description: 'A sample field',
          })
        }
        disabled={create.isPending}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {create.isPending ? 'Creating...' : '+ New Field'}
      </button>

      <ul className="space-y-2">
        {data?.map((field) => (
          <li key={field.id} className="flex items-center justify-between p-3 border rounded">
            <div>
              <span className="font-medium">{field.name}</span>
              <span className="text-sm text-gray-500 ml-2">({field.field_type})</span>
              {field.description && (
                <div className="text-sm text-gray-400">{field.description}</div>
              )}
            </div>
            <button 
              onClick={() => del.mutate(field.id)}
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