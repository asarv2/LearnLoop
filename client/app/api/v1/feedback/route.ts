import { NextResponse } from 'next/server';
import { feedbackRepo, FeedbackCreateSchema } from '@/lib/repos/feedbackRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// POST /api/feedback  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = FeedbackCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid POST body for feedback', { body: json, errors: parse.error });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await feedbackRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/v1/feedback/${created.id}` }
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to create feedback', err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/feedback  – list
export async function GET() {
  try {
    const rows = await feedbackRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to list feedback', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
} 