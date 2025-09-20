import { groupRepo, GroupUpdateSchema } from "@/lib/repos/groupRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextResponse } from "next/server";

// GET /api/groups/[id]  – get single
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const group = await groupRepo.find(params.id);
    return NextResponse.json(group);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to get group", err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// PATCH /api/groups/[id]  – update
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const json = await req.json();
  const parse = GroupUpdateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn("Invalid PATCH body for group", {
      body: json,
      errors: parse.error,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await groupRepo.update(params.id, parse.data);
    return NextResponse.json(updated);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to update group", err, {
      id: params.id,
      data: parse.data,
    });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// DELETE /api/groups/[id]  – delete
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await groupRepo.remove(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to delete group", err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
