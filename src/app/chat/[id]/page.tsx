import type { Metadata } from "next";
import { ChatShell } from "@/components/chat/ChatShell";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Assistant — ${SITE_NAME}`,
  description: "Ask RailSaathi about safety, helplines or a situation on Mumbai local trains.",
};

/**
 * /chat/[id] opens a saved conversation. The id is client-validated against
 * local storage inside ChatShell (history lives only on the user's device), so
 * an unknown id renders a friendly "not found" state rather than a 404.
 */
export default async function ChatByIdPage({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  return <ChatShell chatId={id} />;
}
