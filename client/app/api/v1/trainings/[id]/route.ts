import { trainingRepo, TrainingUpdateSchema } from "@/lib/repos/trainingRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextResponse } from "next/server";

// GET /api/trainings/[id]  – get single
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const training = await trainingRepo.fetchTraining(params.id);
    return NextResponse.json(training);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to get training", err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// PATCH /api/trainings/[id]  – update
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const json = await req.json();
  const parse = TrainingUpdateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn("Invalid PATCH body for training", {
      body: json,
      errors: parse.error,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await trainingRepo.update(params.id, parse.data);
    return NextResponse.json(updated);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to update training", err, {
      id: params.id,
      data: parse.data,
    });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// DELETE /api/trainings/[id]  – delete
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await trainingRepo.remove(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to delete training", err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
