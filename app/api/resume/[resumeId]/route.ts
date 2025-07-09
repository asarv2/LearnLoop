import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import supabaseServer from "@/utils/supabase/supabase-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ resumeId: string }> }
) {
  try {
    const { resumeId } = await params;

    // use supabase to get a URL for the resume
    const supabase = await supabaseServer(cookies());
    const { data, error } = await supabase.storage.from("resumes").download(`${resumeId}.pdf`);
    if (error) {
      return NextResponse.json({ error: 'Error downloading resume' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }
    const resume = await data.arrayBuffer();

    // convert the resume to a blob
    const blob = new Blob([resume], { type: 'application/pdf' });

    // return the blob
    return new NextResponse(blob, {
      headers: { 'Content-Type': 'application/pdf' },
    });
  } catch (error) {
    console.error('Error fetching resume:', error);
    return NextResponse.json({ error: 'Failed to fetch resume' }, { status: 500 });
  }
} 