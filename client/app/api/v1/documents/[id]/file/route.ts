import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { logError } from '@/utils/logger';

const ONE_HOUR = 3600;       // presigned URL life

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const url = await storage.getSignedUrl(`${params.id}.pdf`, ONE_HOUR);
    /* 302 keeps method=GET; 307 if you want to preserve original verb */
    return NextResponse.redirect(url, {
      status: 302,
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    await logError('Failed to presign document', err, { id: params.id });
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
} 