// TODO: refactor
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from '@/utils/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // use supabase to get a URL for the resume
    const supabase = await supabaseServer(cookies());
    const { data, error } = await supabase.storage.from("documents").download(`${id}.pdf`);
    if (error) {
      return NextResponse.json({ error: 'Error downloading document' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    const document = await data.arrayBuffer();

    // convert the resume to a blob
    const blob = new Blob([document], { type: 'application/pdf' });

    // return the blob
    return new NextResponse(blob, {
      headers: { 'Content-Type': 'application/pdf' },
    });
  } catch (error) {
    logError('Error fetching document:', error);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
} 