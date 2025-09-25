import { TrainingCreateSchema, trainingRepo } from "@/lib/repos/trainingRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextResponse } from "next/server";

// POST /api/trainings  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = TrainingCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn("Invalid POST body for training", {
      body: json,
      errors: parse.error,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await trainingRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/trainings/${created.id}` },
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to create training", err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/trainings  – list
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const practice = searchParams.get("practice");
    const type = searchParams.get("type") as
      | "standard"
      | "required"
      | "custom"
      | null;
    const userId = searchParams.get("userId");
    const company = searchParams.get("company");

    let rows;
    if (type === "custom" && userId) {
      rows = await trainingRepo.listCustomForUser(userId);
    } else if (
      type &&
      ["standard", "required", "custom"].includes(type) &&
      company !== undefined
    ) {
      rows = await trainingRepo.listByTypeAndCompany(type, company);
    } else if (type && ["standard", "required", "custom"].includes(type)) {
      rows = await trainingRepo.listByType(type);
    } else if (practice === "true") {
      rows = await trainingRepo.listPractice();
    } else {
      rows = await trainingRepo.list();
    }

    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to list trainings", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
