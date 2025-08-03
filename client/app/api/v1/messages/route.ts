import {
  MessageCreate,
  MessageCreateSchema,
  messageRepo,
} from "@/lib/repos/messageRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextResponse } from "next/server";

// POST /api/messages  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = MessageCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn("Invalid POST body for message", {
      body: json,
      errors: parse.error,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await messageRepo.create(parse.data as MessageCreate);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/messages/${created.id}` },
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to create message", err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/messages  – list
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chat_id");

    if (!chatId) {
      return NextResponse.json(
        { error: "chat_id parameter is required" },
        { status: 400 }
      );
    }

    const rows = await messageRepo.listByChatId(chatId);
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to list messages", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
