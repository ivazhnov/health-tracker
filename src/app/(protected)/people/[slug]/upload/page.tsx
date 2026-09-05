import { notFound } from "next/navigation";
import { UploadForm } from "@/app/imports/upload-form";
import { fullName } from "@/app/format";
import { getProfileBySlug } from "@/server/services";

export default async function UploadPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const profile = getProfileBySlug((await params).slug);
  if (!profile) notFound();
  return <main className="person-page compact-form-page"><div className="page-heading"><div><h1>Загрузить анализы</h1><p>{fullName(profile.firstName, profile.lastName)}</p></div></div>
    {(await searchParams).error ? <p className="notice error">Выберите хотя бы один файл.</p> : null}
    <UploadForm profileId={profile.id} personSlug={profile.slug} />
  </main>;
}
