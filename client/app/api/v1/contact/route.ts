import {
  ContactMessageCreate,
  ContactMessageCreateSchema,
  contactMessageRepo,
} from "@/lib/repos/contactMessageRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextResponse } from "next/server";

// POST /api/v1/contact – create contact message
export async function POST(req: Request) {
  const json = await req.json();
  const parse = ContactMessageCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn("Invalid POST body for contact message", {
      body: json,
      errors: parse.error,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await contactMessageRepo.create(
      parse.data as ContactMessageCreate
    );
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/v1/contact/${created.id}` },
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to create contact message", err, {
      data: parse.data,
    });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/v1/contact – list contact messages
export async function GET() {
  try {
    const messages = await contactMessageRepo.list();
    return NextResponse.json(messages);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to list contact messages", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
