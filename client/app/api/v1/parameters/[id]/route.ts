import { NextResponse } from 'next/server';
import {
  parameterRepo,
  ParameterUpdateSchema
} from '@/lib/repos/parameterRepo';
import { logError, logWarn } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const row = await parameterRepo.find(params.id);
    return NextResponse.json(row);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to find parameter', err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const json = await req.json();
  const parse = ParameterUpdateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn('Invalid PATCH body for parameter', { body: json, errors: parse.error, id: params.id });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const row = await parameterRepo.update(params.id, parse.data);
    return NextResponse.json(row);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to update parameter', err, { id: params.id, data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await parameterRepo.remove(params.id);
    return NextResponse.json({}, { status: 204 });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to delete parameter', err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
} 