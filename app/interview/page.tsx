/**
 * app/interview/page.tsx
 * Interview setup page for the interview simulation platform.
 * @AshokSaravanan222 & @siladiea
 * 2025-07-09
 */

import InterviewHomepage from "@/components/InterviewHomepage";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interview",
  description: "Interview with a candidate using LearnLoop.",
};

export default function InterviewPage() {
    return <InterviewHomepage />;
}