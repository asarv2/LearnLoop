// app/api/rtc-boot/route.ts (Next.js App Router)
import { NextResponse } from "next/server";

function parseCsv(v?: string | null): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET() {
  try {
    // Get ICE servers from environment
    const stunUris = parseCsv(process.env.STUN_URI); // e.g. stun:stun.l.google.com:19302
    const turnUris = parseCsv(process.env.TURN_URI); // e.g. turns:turn.example.com:5349?transport=tcp
    const username = process.env.TURN_USERNAME || undefined;
    const credential = process.env.TURN_PASSWORD || undefined;

    const iceServers: RTCIceServer[] = [];
    if (stunUris.length) iceServers.push({ urls: stunUris });
    if (turnUris.length && username && credential) {
      iceServers.push({ urls: turnUris, username, credential });
    }

    // Return only ICE servers configuration
    return NextResponse.json({ iceServers });
  } catch (error) {
    console.error("Error loading ICE config:", error);
    return NextResponse.json(
      { error: "Failed to load ICE config" },
      { status: 500 }
    );
  }
}
