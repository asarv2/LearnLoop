import { GroupCreateSchema, groupRepo } from "@/lib/repos/groupRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextResponse } from "next/server";

// POST /api/groups  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = GroupCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn("Invalid POST body for group", {
      body: json,
      errors: parse.error,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await groupRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/v1/groups/${created.id}` },
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to create group", err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/groups  – list
export async function GET() {
  try {
    const groups = await groupRepo.list();
    return NextResponse.json(groups);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to list groups", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
