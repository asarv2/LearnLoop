import { profileRepo, ProfileUpdateSchema } from "@/lib/repos/profileRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextResponse } from "next/server";

// GET /api/profiles/[id]  – get by id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profile = await profileRepo.find(id);
    return NextResponse.json(profile);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to get profile", err, { id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// PATCH /api/profiles/[id]  – update
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const json = await req.json();
  const parse = ProfileUpdateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn("Invalid PATCH body for profile", {
      body: json,
      errors: parse.error,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const { id } = await params;
    const updated = await profileRepo.update(id, parse.data);
    return NextResponse.json(updated);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to update profile", err, { id, data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// DELETE /api/profiles/[id]  – delete
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await profileRepo.remove(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to delete profile", err, { id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
