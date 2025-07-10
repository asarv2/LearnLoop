/**
 * app/interview/new/page.tsx
 * Interview setup page for the interview simulation platform.
 * @AshokSaravanan222 & @siladiea
 * 2025-07-09
 */

import NewInterview from "@/components/NewInterview";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Interview",
  description: "Interview with a candidate using LearnLoop.",
};

export default function InterviewPage() {
    return <NewInterview/>;
}