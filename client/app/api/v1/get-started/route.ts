import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyName,
      street,
      city,
      state,
      zipCode,
      country,
      employeeFirstName,
      employeeLastName,
      employeePosition,
      employeeEmail,
      pricingPlan,
    } = body;

    // Validate required fields
    if (
      !companyName ||
      !street ||
      !city ||
      !state ||
      !zipCode ||
      !country ||
      !employeeFirstName ||
      !employeeLastName ||
      !employeePosition ||
      !employeeEmail ||
      !pricingPlan
    ) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(employeeEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // Create Supabase client with service role
    const cookieStore = await cookies();
    const supabase = await supabaseServer(cookieStore, true);

    // Combine address fields into JSON object
    const companyAddress = {
      street,
      city,
      state,
      zipCode,
      country,
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from("get_started_submissions")
      .insert([
        {
          corporation_name: companyName,
          company_address: companyAddress,
          employee_first_name: employeeFirstName,
          employee_last_name: employeeLastName,
          employee_position: employeePosition,
          employee_email: employeeEmail,
          pricing_plan: pricingPlan,
          submitted_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to submit request. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Request submitted successfully",
        id: data[0]?.id,
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
