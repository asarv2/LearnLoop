import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Company code is required" },
        { status: 400 }
      );
    }

    // Create Supabase client with service role
    const cookieStore = await cookies();
    const supabase = await supabaseServer(cookieStore, true);

    // Check if company code exists and is active
    const { data, error } = await supabase
      .from("company_codes")
      .select(
        "id, code, company_name, is_active, expires_at, usage_limit, times_used"
      )
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Invalid company code" },
        { status: 400 }
      );
    }

    // Check if code has expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Company code has expired" },
        { status: 400 }
      );
    }

    // Check usage limit
    if (data.usage_limit && data.times_used >= data.usage_limit) {
      return NextResponse.json(
        { error: "Company code has reached its usage limit" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        companyName: data.company_name,
        codeId: data.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
