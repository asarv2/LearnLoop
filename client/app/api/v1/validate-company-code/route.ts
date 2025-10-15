// import supabaseServer from "@/utils/supabase/supabase-server";
// import { cookies } from "next/headers";
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
    // const supabase = await supabaseServer(cookies(), true);

    // TODO: Implement company code validation when company_codes table is available
    // For now, return a mock response
    return NextResponse.json(
      {
        valid: true,
        companyName: "Demo Company",
        codeId: "demo-id",
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
