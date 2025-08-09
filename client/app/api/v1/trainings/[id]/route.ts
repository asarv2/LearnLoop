import { trainingRepo, TrainingUpdateSchema } from "@/lib/repos/trainingRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextResponse } from "next/server";

// GET /api/trainings/[id]  – get single
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const training = await trainingRepo.fetchTraining(id);
    return NextResponse.json(training);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to get training", err, { id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// PATCH /api/trainings/[id]  – update
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const json = await req.json();
  const parse = TrainingUpdateSchema.safeParse(json);
  if (!parse.success) {
    const { id } = await params;
    await logWarn("Invalid PATCH body for training", {
      body: json,
      errors: parse.error,
      id,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const { id } = await params;
    const updated = await trainingRepo.update(id, parse.data);
    return NextResponse.json(updated);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to update training", err, {
      id,
      data: parse.data,
    });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// DELETE /api/trainings/[id]  – delete
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await trainingRepo.remove(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to delete training", err, { id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
