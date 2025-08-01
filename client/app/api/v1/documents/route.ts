import { NextResponse } from 'next/server';
import { documentRepo, DocumentCreateSchema } from '@/lib/repos/documentRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// POST /api/documents  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = DocumentCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid POST body for document', { body: json, errors: parse.error });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await documentRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/v1/documents/${created.id}` }
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to create document', err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/documents  – list
export async function GET() {
  try {
    const rows = await documentRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to list documents', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
