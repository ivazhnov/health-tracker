import { getApplicationStatus } from "@/server/services";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const status = getApplicationStatus();

    return Response.json({
      status: "ok",
      storage: {
        installationId: status.installationId,
        createdAt: status.createdAt,
        schemaVersion: status.schemaVersion,
      },
    });
  } catch (error) {
    console.error(
      "Health check failed:",
      error instanceof Error ? error.message : "unknown error",
    );

    return Response.json({ status: "error" }, { status: 503 });
  }
}
