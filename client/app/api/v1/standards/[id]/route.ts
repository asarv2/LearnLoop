import { NextResponse } from 'next/server';
import { standardRepo, StandardUpdateSchema } from '@/lib/repos/standardRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// GET /api/standards/[id]  – get by id
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const standard = await standardRepo.find(params.id);
    return NextResponse.json(standard);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to get standard', err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// PATCH /api/standards/[id]  – update
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const json = await req.json();
  const parse = StandardUpdateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid PATCH body for standard', { body: json, errors: parse.error });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await standardRepo.update(params.id, parse.data);
    return NextResponse.json(updated);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to update standard', err, { id: params.id, data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// DELETE /api/standards/[id]  – delete
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await standardRepo.remove(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to delete standard', err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
