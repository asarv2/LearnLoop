import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company, currentPlan, usersToAdd, totalCost, requestedBy } = body;

    // Validate required fields
    if (!company || !currentPlan || !usersToAdd || usersToAdd <= 0) {
      return NextResponse.json(
        { error: "Missing required fields or invalid user count" },
        { status: 400 }
      );
    }

    // Validate plan
    const validPlans = [
      "starter",
      "growth",
      "professional",
      "scale",
      "enterprise",
    ];
    if (!validPlans.includes(currentPlan)) {
      return NextResponse.json(
        { error: "Invalid plan specified" },
        { status: 400 }
      );
    }

    // Create Supabase client with service role
    const supabase = await supabaseServer(cookies(), true);

    // Insert the user addition request
    const { data, error } = await supabase
      .from("user_addition_requests")
      .insert([
        {
          company,
          current_plan: currentPlan,
          users_to_add: usersToAdd,
          total_cost: totalCost || 0,
          requested_by: requestedBy || company,
          status: "pending",
        },
      ])
      .select();

    if (error) {
      console.error("Error inserting user addition request:", error);
      return NextResponse.json(
        { error: "Failed to submit request" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User addition request submitted successfully",
      requestId: data[0]?.id,
    });
  } catch (error) {
    console.error("Error in add-users API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
