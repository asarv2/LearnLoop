import { NextResponse } from 'next/server';
import { fieldRepo, FieldCreateSchema } from '@/lib/repos/fieldRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// POST /api/fields  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = FieldCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid POST body for field', { body: json, errors: parse.error });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await fieldRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/v1/fields/${created.id}` }
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to create field', err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/fields  – list
export async function GET() {
  try {
    const rows = await fieldRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to list fields', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
} 