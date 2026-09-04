import type { ReactNode } from "react";
import { requireSession } from "@/server/auth/session";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSession();
  return children;
}
