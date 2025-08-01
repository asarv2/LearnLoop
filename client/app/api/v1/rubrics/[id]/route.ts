import { NextResponse } from 'next/server';
import { rubricRepo, RubricUpdateSchema } from '@/lib/repos/rubricRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// GET /api/rubrics/[id]  – get by id
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const rubric = await rubricRepo.find(params.id);
    return NextResponse.json(rubric);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to get rubric', err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// PATCH /api/rubrics/[id]  – update
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const json = await req.json();
  const parse = RubricUpdateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid PATCH body for rubric', { body: json, errors: parse.error });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await rubricRepo.update(params.id, parse.data);
    return NextResponse.json(updated);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to update rubric', err, { id: params.id, data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// DELETE /api/rubrics/[id]  – delete
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await rubricRepo.remove(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to delete rubric', err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
