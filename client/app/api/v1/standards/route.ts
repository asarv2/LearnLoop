import { NextResponse } from 'next/server';
import { standardRepo, StandardCreateSchema } from '@/lib/repos/standardRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// POST /api/standards  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = StandardCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid POST body for standard', { body: json, errors: parse.error });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await standardRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/v1/standards/${created.id}` }
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to create standard', err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/standards  – list
export async function GET() {
  try {
    const rows = await standardRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to list standards', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
