import { NextResponse } from 'next/server';
import { assessmentRepo, AssessmentCreateSchema } from '@/lib/repos/assessmentRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// POST /api/assessments  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = AssessmentCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid POST body for assessment', { body: json, errors: parse.error });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await assessmentRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/assessments/${created.id}` }
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to create assessment', err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/assessments  – list
export async function GET() {
  try {
    const rows = await assessmentRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to list assessments', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
