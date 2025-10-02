import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import { NextResponse } from "next/server";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, standards } = body;

    // Validate input
    if (!name || !standards || !Array.isArray(standards)) {
      return NextResponse.json(
        { error: "Invalid input: name and standards array are required" },
        { status: 400 }
      );
    }

    if (standards.length === 0) {
      return NextResponse.json(
        { error: "At least one standard is required" },
        { status: 400 }
      );
    }

    // Call the Python server to run the rubric generation agent
    const serverResponse = await fetch(`${SERVER_URL}/rubrics/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rubric_name: name,
        rubric_description: description || "",
        standards: standards.map((s: any) => ({
          name: s.name,
          description: s.description || "",
        })),
        num_levels: standards[0]?.items?.length || 5,
      }),
    });

    if (!serverResponse.ok) {
      const errorData = await serverResponse.json();
      throw new Error(
        errorData.detail || errorData.error || "Rubric generation failed"
      );
    }

    const result = await serverResponse.json();

    return NextResponse.json({
      success: true,
      standards: result.standards,
      message: "Rubric generated successfully",
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to generate rubric", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
