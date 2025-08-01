import { NextResponse } from 'next/server';
import { documentRepo, DocumentUpdateSchema } from '@/lib/repos/documentRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// GET /api/documents/[id]  – get by id
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const document = await documentRepo.find(params.id);
    return NextResponse.json(document);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to get document', err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// PATCH /api/documents/[id]  – update
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const json = await req.json();
  const parse = DocumentUpdateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid PATCH body for document', { body: json, errors: parse.error });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await documentRepo.update(params.id, parse.data);
    return NextResponse.json(updated);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to update document', err, { id: params.id, data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// DELETE /api/documents/[id]  – delete
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await documentRepo.remove(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to delete document', err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
