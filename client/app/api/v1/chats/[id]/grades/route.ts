import { rubricRepo } from "@/lib/repos/rubricRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import { NextResponse } from "next/server";

// GET /api/chats/[id]/grades  – get all grades for a chat
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const grades = await rubricRepo.getGradesByChatId(id);
    return NextResponse.json(grades);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to get chat grades", err, { chatId: id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
