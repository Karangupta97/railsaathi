import type { Metadata } from "next";
import { ChatShell } from "@/components/chat/ChatShell";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Assistant — ${SITE_NAME}`,
  description: "Ask RailSaathi about safety, helplines or a situation on Mumbai local trains.",
};

/**
 * /chat is a server component that mounts the client ChatShell. Everything
 * interactive lives inside ChatShell; the page stays a thin server boundary.
 */
export default function ChatPage() {
  return <ChatShell />;
}
