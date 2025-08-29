// utils/rtc.ts
export type RtcBoot = {
  iceServers: RTCIceServer[];
  roomId: string;
};

export async function fetchRtcBoot(): Promise<RtcBoot> {
  const r = await fetch("/api/rtc-boot", { cache: "no-store" });
  if (!r.ok) throw new Error("rtc-boot fetch failed");
  return r.json();
}
