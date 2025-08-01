/**
 * app/interview/page.tsx
 * Interview setup page for the interview simulation platform.
 * @AshokSaravanan222 & @siladiea
 * 2025-07-09
 */

import InterviewHomepage from "@/client/components/InterviewHomepage";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interview",
  description: "Look at past interviews in LearnLoop.",
};

export default function InterviewPage() {
    return <InterviewHomepage />;
}