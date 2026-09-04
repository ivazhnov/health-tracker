import { hasSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { getSourceDocument, readSourceDocument } from "@/server/services";

type DocumentRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: DocumentRouteContext) {
  if (!(await hasSession())) {
    redirect("/login");
  }

  const documentId = Number((await context.params).id);
  const document = Number.isInteger(documentId)
    ? getSourceDocument(documentId)
    : null;

  if (!document) {
    return new Response("Документ не найден", { status: 404 });
  }

  try {
    const contents = await readSourceDocument(document.storagePath);
    return new Response(Uint8Array.from(contents).buffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Length": String(document.sizeBytes),
        "Content-Type": document.mediaType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Не удалось открыть документ", { status: 500 });
  }
}
