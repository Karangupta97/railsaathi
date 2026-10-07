import type { Metadata } from "next";
import { ChatShell } from "@/components/chat/ChatShell";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Assistant — ${SITE_NAME}`,
  description: "Ask RailSaathi about safety, helplines or a situation on Mumbai local trains.",
};

/** /chat = a fresh conversation. The URL becomes /chat/[id] on the first send. */
export default function ChatPage() {
  return <ChatShell />;
}
