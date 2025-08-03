import { logRepo, LogUpdateSchema } from "@/lib/repos/logRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const row = await logRepo.find(params.id);
    return NextResponse.json(row);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to find log", err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const json = await req.json();
  const parse = LogUpdateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn("Invalid PATCH body for log", {
      body: json,
      errors: parse.error,
      id: params.id,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const row = await logRepo.update(params.id, parse.data);
    return NextResponse.json(row);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to update log", err, {
      id: params.id,
      data: parse.data,
    });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await logRepo.remove(params.id);
    return NextResponse.json({}, { status: 204 });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to delete log", err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
