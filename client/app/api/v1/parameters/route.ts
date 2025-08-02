import {
  ParameterCreateSchema,
  parameterRepo,
} from "@/lib/repos/parameterRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextResponse } from "next/server";

// POST /api/parameters  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = ParameterCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn("Invalid POST body for parameter", {
      body: json,
      errors: parse.error,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await parameterRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/parameters/${created.id}` },
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to create parameter", err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/parameters  – list
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fieldId = searchParams.get("field_id");

    const rows = fieldId
      ? await parameterRepo.findByField(fieldId)
      : await parameterRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to list parameters", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
