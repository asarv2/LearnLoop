import { NextResponse } from 'next/server';
import { personaRepo, PersonaCreateSchema } from '@/lib/repos/personaRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// POST /api/personas  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = PersonaCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid POST body for persona', { body: json, errors: parse.error });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await personaRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/personas/${created.id}` }
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to create persona', err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/personas  – list
export async function GET() {
  try {
    const rows = await personaRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to list personas', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
} 