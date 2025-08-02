/**
 * app/dashboard/history/page.tsx
 * Used to show the history of the user.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */

import History from "@/components/history/History";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "History",
  description: `History of the user on LearnLoop.`,
};

export default function HistoryPage() {
  return <History />;
}