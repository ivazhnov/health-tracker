import { notFound } from "next/navigation";
import { AnalysisDetail } from "@/app/analyses/analysis-detail";
import { getImport, getProfileBySlug } from "@/server/services";

export const dynamic = "force-dynamic";

export default async function AnalysisPage({ params, searchParams }: { params: Promise<{ slug: string; analysisId: string }>; searchParams: Promise<{ confirmed?: string }> }) {
  const values = await params;
  const profile = getProfileBySlug(values.slug);
  const item = getImport(Number(values.analysisId));
  if (!profile || !item || item.profileId !== profile.id) notFound();
  return <AnalysisDetail importId={item.id} personSlug={profile.slug} justConfirmed={(await searchParams).confirmed === "1"} />;
}
