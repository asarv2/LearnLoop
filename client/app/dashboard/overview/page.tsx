/**
 * app/dashboard/overview/page.tsx
 * Used to show the overview of the application.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */

import Overview from "@/components/overview/Overview";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Overview",
  description: `Overview of the user on LearnLoop.`,
};


export default function OverviewPage() {
  return <Overview />;
}