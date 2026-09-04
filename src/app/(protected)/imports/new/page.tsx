import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { uploadFilesAction } from "@/app/imports/actions";
import { MAX_FILE_SIZE_BYTES, MAX_UPLOAD_FILES } from "@/server/imports";
import { listProfiles } from "@/server/services";

type UploadPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const profiles = listProfiles();
  const activeId = Number((await cookies()).get("active_profile_id")?.value);
  const profile = profiles.find(({ id }) => id === activeId) ?? profiles[0];

  if (!profile) {
    redirect("/profiles/new");
  }

  const { error } = await searchParams;

  return (
    <main className="form-page wide-page">
      <Link className="back-link" href="/">
        ← {profile.firstName}
      </Link>
      <p className="eyebrow">Новые анализы</p>
      <h1>Загрузить документы</h1>
      <p className="lead small">
        Каждый файл станет отдельной сессией в профиле {profile.firstName}.
      </p>

      {error === "no_files" ? (
        <p className="notice error">Выберите хотя бы один файл.</p>
      ) : null}

      <form action={uploadFilesAction} className="upload-card">
        <input name="profileId" type="hidden" value={profile.id} />
        <label className="file-picker">
          <span>Выберите файлы</span>
          <input
            accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
            multiple
            name="files"
            required
            type="file"
          />
        </label>
        <p className="upload-hint">
          PDF, PNG, JPEG или TXT. До {MAX_UPLOAD_FILES} файлов, каждый не больше{" "}
          {MAX_FILE_SIZE_BYTES / (1024 * 1024)} МБ.
        </p>
        <div className="form-actions">
          <Link className="secondary-button" href="/">
            Отмена
          </Link>
          <button className="primary-button" type="submit">
            Загрузить
          </button>
        </div>
      </form>
    </main>
  );
}
