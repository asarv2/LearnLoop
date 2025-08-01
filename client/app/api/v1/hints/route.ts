import { NextResponse } from 'next/server';
import { hintRepo, HintCreateSchema } from '@/lib/repos/hintRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// POST /api/hints  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = HintCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid POST body for hint', { body: json, errors: parse.error });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await hintRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/v1/hints/${created.id}` }
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to create hint', err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/hints  – list
export async function GET() {
  try {
    const rows = await hintRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to list hints', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
} 