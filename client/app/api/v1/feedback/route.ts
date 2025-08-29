import {
  UserFeedbackCreateSchema,
  userFeedbackRepo,
} from "@/lib/repos/userFeedbackRepo";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate the request body
    const validatedData = UserFeedbackCreateSchema.parse(body);

    // Create the feedback entry
    const feedback = await userFeedbackRepo.create(validatedData);

    return NextResponse.json(
      {
        success: true,
        data: feedback,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user feedback:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to submit feedback",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const feedbacks = await userFeedbackRepo.list();

    return NextResponse.json(
      {
        success: true,
        data: feedbacks,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching user feedback:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch feedback",
      },
      { status: 500 }
    );
  }
}
