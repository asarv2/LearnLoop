import { NextResponse } from 'next/server';
import { rubricRepo, RubricCreateSchema } from '@/lib/repos/rubricRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// POST /api/rubrics  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = RubricCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid POST body for rubric', { body: json, errors: parse.error });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await rubricRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/v1/rubrics/${created.id}` }
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to create rubric', err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/rubrics  – list
export async function GET() {
  try {
    const rows = await rubricRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to list rubrics', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
