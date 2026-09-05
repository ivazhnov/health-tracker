"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { getImport, recogniseImport } from "@/server/services";

export async function retryRecognitionAction(importSessionId: number, returnTo = "") {
  await requireSession();
  const item = getImport(importSessionId);

  if (!item?.sourceDocumentId) {
    redirect("/imports");
  }

  await recogniseImport(importSessionId);
  revalidatePath(`/imports/${importSessionId}`);
  revalidatePath("/imports");
  redirect(returnTo.startsWith("/people/") ? returnTo : `/imports/${importSessionId}`);
}
