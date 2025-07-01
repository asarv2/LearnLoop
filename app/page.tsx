/**
 * app/page.tsx
 * The main page for the chat application.
 * @AshokSaravanan222 & @siladiea
 */

import ChatPage from "@/components/ChatPage";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat",
  description: "Chat page to interact with different simulations.",
};

export default function Home() {
  return <ChatPage />;
}
