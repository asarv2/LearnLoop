import { NextResponse } from 'next/server';
import {
  hintRepo,
  HintUpdateSchema
} from '@/lib/repos/hintRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const row = await hintRepo.find(params.id);
    return NextResponse.json(row);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to find hint', err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const json = await req.json();
  const parse = HintUpdateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid PATCH body for hint', { body: json, errors: parse.error, id: params.id });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const row = await hintRepo.update(params.id, parse.data);
    return NextResponse.json(row);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to update hint', err, { id: params.id, data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await hintRepo.remove(params.id);
    return NextResponse.json({}, { status: 204 });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to delete hint', err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
} 