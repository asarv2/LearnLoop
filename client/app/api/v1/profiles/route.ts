import { NextResponse } from 'next/server';
import { profileRepo, ProfileCreateSchema } from '@/lib/repos/profileRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// POST /api/profiles  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = ProfileCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid POST body for profile', { body: json, errors: parse.error });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await profileRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/v1/profiles/${created.id}` }
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to create profile', err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/profiles  – list
export async function GET() {
  try {
    const rows = await profileRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to list profiles', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
} 