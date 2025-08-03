import { attemptRepo, AttemptUpdateSchema } from "@/lib/repos/attemptRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await attemptRepo.find(id);
    return NextResponse.json(row);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to find attempt", err, { id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const json = await req.json();
  const parse = AttemptUpdateSchema.safeParse(json);
  if (!parse.success) {
    const { id } = await params;
    await logWarn("Invalid PATCH body for attempt", {
      body: json,
      errors: parse.error,
      id,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const { id } = await params;
    const row = await attemptRepo.update(id, parse.data);
    return NextResponse.json(row);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to update attempt", err, { id, data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await attemptRepo.remove(id);
    return NextResponse.json({}, { status: 204 });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to delete attempt", err, { id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
