import { NextResponse } from 'next/server';
import {
  chatRepo,
  ChatUpdateSchema
} from '@/lib/repos/chatRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const row = await chatRepo.find(params.id);
    return NextResponse.json(row);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to find chat', err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const json = await req.json();
  const parse = ChatUpdateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid PATCH body for chat', { body: json, errors: parse.error, id: params.id });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const row = await chatRepo.update(params.id, parse.data);
    return NextResponse.json(row);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to update chat', err, { id: params.id, data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await chatRepo.remove(params.id);
    return NextResponse.json({}, { status: 204 });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to delete chat', err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
