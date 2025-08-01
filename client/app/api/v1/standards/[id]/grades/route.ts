import { NextResponse } from 'next/server';
import { standardRepo } from '@/lib/repos/standardRepo';
import { logError } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// GET /api/standards/[id]/grades  – get all grades for a standard
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const grades = await standardRepo.getGrades(params.id);
    return NextResponse.json(grades);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to get standard grades', err, { standardId: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
