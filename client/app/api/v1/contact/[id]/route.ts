import {
  ContactMessageUpdate,
  ContactMessageUpdateSchema,
  contactMessageRepo,
} from "@/lib/repos/contactMessageRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError, logWarn } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

// GET /api/v1/contact/[id] – get contact message by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const message = await contactMessageRepo.getById(params.id);
    return NextResponse.json(message);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to get contact message", err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// PUT /api/v1/contact/[id] – update contact message
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const json = await req.json();
  const parse = ContactMessageUpdateSchema.safeParse(json);
  if (!parse.success) {
    await logWarn("Invalid PUT body for contact message", {
      body: json,
      errors: parse.error,
    });
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await contactMessageRepo.update(
      params.id,
      parse.data as ContactMessageUpdate
    );
    return NextResponse.json(updated);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to update contact message", err, {
      id: params.id,
      data: parse.data,
    });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

// DELETE /api/v1/contact/[id] – delete contact message
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await contactMessageRepo.delete(params.id);
    return NextResponse.json(result);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to delete contact message", err, { id: params.id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
