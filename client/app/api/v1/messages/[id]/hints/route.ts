import { NextResponse } from 'next/server';
import { messageRepo } from '@/lib/repos/messageRepo';
import { logError } from '@/utils/logger';
import { handleHttpError } from '@/utils/HttpError';

// GET /api/messages/[id]/hints  – get all hints for a message
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const hints = await messageRepo.getHints(params.id);
    return NextResponse.json(hints);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError('Failed to get message hints', err, { messageId: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
} 