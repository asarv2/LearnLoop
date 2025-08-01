import { NextResponse } from 'next/server';
import { questionRepo, QuestionCreateSchema } from '@/lib/repos/questionRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// POST /api/questions  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = QuestionCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid POST body for question', { body: json, errors: parse.error });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await questionRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/v1/questions/${created.id}` }
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to create question', err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/questions  – list
export async function GET() {
  try {
    const rows = await questionRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to list questions', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
} 