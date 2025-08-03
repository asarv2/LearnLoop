import { standardRepo, StandardUpdateSchema } from "@/lib/repos/standardRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextResponse } from "next/server";

// GET /api/standards/[id]  – get by id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const standard = await standardRepo.find(id);
    return NextResponse.json(standard);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to get standard", err, { id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// PATCH /api/standards/[id]  – update
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const json = await req.json();
  const parse = StandardUpdateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn("Invalid PATCH body for standard", {
      body: json,
      errors: parse.error,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const { id } = await params;
    const updated = await standardRepo.update(id, parse.data);
    return NextResponse.json(updated);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to update standard", err, { id, data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// DELETE /api/standards/[id]  – delete
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await standardRepo.remove(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to delete standard", err, { id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
