// app/api/rtc-boot/route.ts (Next.js App Router)
import { NextResponse } from "next/server";

function parseCsv(v?: string | null): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

  try {
    // Call the server's /rtc/boot endpoint
    const bootRes = await fetch(`${apiBase}/rtc/boot`);
    if (!bootRes.ok) {
      throw new Error(`Server boot request failed: ${bootRes.status}`);
    }

    const bootData = await bootRes.json();

    // Get ICE servers from environment (not from server)
    const stunUris = parseCsv(process.env.STUN_URI); // e.g. stun:stun.l.google.com:19302
    const turnUris = parseCsv(process.env.TURN_URI); // e.g. turns:turn.example.com:5349?transport=tcp
    const username = process.env.TURN_USERNAME || undefined;
    const credential = process.env.TURN_PASSWORD || undefined;

    const iceServers: RTCIceServer[] = [];
    if (stunUris.length) iceServers.push({ urls: stunUris });
    if (turnUris.length && username && credential) {
      iceServers.push({ urls: turnUris, username, credential });
    }

    // Return combined data: ICE servers from env + boot data from server
    return NextResponse.json({
      iceServers,
      roomId: bootData.roomId,
      messages: bootData.messages || [],
    });
  } catch (error) {
    console.error("Error fetching boot data:", error);
    return NextResponse.json(
      { error: "Failed to fetch boot data" },
      { status: 500 }
    );
  }
}
