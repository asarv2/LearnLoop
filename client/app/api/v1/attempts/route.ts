import { AttemptCreateSchema, attemptRepo } from "@/lib/repos/attemptRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// POST /api/attempts  – create
export async function POST(req: Request) {
  const json = await req.json();
  const parse = AttemptCreateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn("Invalid POST body for attempt", {
      body: json,
      errors: parse.error,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const created = await attemptRepo.create(parse.data);
    return NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/v1/attempts/${created.id}` },
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to create attempt", err, { data: parse.data });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// GET /api/attempts  – list
export async function GET() {
  try {
    // Get current user from Supabase
    const supabase = await supabaseServer(cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The user ID is the same as the profile ID in this system
    const profileId = user.id;
    const rows = await attemptRepo.list(profileId);
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to list attempts", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
