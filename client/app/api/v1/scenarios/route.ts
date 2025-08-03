import { ScenarioCreateSchema, scenarioRepo } from "@/lib/repos/scenarioRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextResponse } from "next/server";

// POST /api/scenarios  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = ScenarioCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn("Invalid POST body for scenario", {
      body: json,
      errors: parse.error,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await scenarioRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/v1/scenarios/${created.id}` },
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to create scenario", err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/scenarios  – list
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const trainingId = searchParams.get("training_id");

    if (trainingId) {
      const rows = await scenarioRepo.listByTrainingId(trainingId);
      return NextResponse.json(rows);
    }

    const rows = await scenarioRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to list scenarios", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
