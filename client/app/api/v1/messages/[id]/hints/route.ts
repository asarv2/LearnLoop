import { messageRepo } from "@/lib/repos/messageRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import { NextResponse } from "next/server";

// GET /api/messages/[id]/hints  – get all hints for a message
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const hints = await messageRepo.getHints(id);
    return NextResponse.json(hints);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to get message hints", err, { messageId: id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
