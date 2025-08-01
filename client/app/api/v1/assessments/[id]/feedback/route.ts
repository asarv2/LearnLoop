import { NextResponse } from 'next/server';
import { assessmentRepo } from '@/lib/repos/assessmentRepo';
import { logError } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// GET /api/assessments/[id]/feedback  – get all feedback for an assessment
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const feedback = await assessmentRepo.getFeedback(params.id);
    return NextResponse.json(feedback);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to get assessment feedback', err, { assessmentId: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
