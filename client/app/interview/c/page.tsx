/**
 * app/interview/c/page.tsx
 * Interview page for the interview section.
 * @AshokSaravanan222 & @siladiea
 * 2025-07-09
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interview",
  description: "Interview in LearnLoop.",
};

export default function ClassPage() {
  return redirect("/interview/new");
}
