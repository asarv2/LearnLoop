import createSupabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServer(cookies(), true); // true for service role

    // Check if email already exists
    const { data: existingSubscription } = await supabase
      .from("email_subscriptions")
      .select("id, status")
      .eq("email", email.toLowerCase())
      .single();

    if (existingSubscription) {
      if (existingSubscription.status === "unsubscribed") {
        // Reactivate subscription
        const { error: updateError } = await supabase
          .from("email_subscriptions")
          .update({
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSubscription.id);

        if (updateError) {
          console.error("Error reactivating subscription:", updateError);
          return NextResponse.json(
            { error: "Failed to update subscription" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          message: "Welcome back! You've been re-subscribed to our updates.",
          success: true,
        });
      } else {
        return NextResponse.json(
          { error: "This email is already subscribed" },
          { status: 409 }
        );
      }
    }

    // Insert new subscription
    console.log("Attempting to insert subscription for:", email.toLowerCase());
    const { data: insertData, error: insertError } = await supabase
      .from("email_subscriptions")
      .insert({
        email: email.toLowerCase(),
        source: "landing_page",
      })
      .select();

    if (insertError) {
      console.error("Error creating subscription:", insertError);
      console.error(
        "Insert error details:",
        JSON.stringify(insertError, null, 2)
      );
      return NextResponse.json(
        { error: "Failed to create subscription" },
        { status: 500 }
      );
    }

    console.log("Successfully inserted subscription:", insertData);

    return NextResponse.json({
      message:
        "Welcome to our early access community! We'll be in touch soon about getting you started with LearnLoop.",
      success: true,
    });
  } catch (error) {
    console.error("Subscribe API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
