import Link from "next/link";
import { ImportList } from "@/app/imports/import-list";
import { listImports } from "@/server/services";

type ImportsPageProps = {
  searchParams: Promise<{ failed?: string; uploaded?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  const imports = listImports();
  const { failed, uploaded } = await searchParams;
  const uploadedCount = Number(uploaded) || 0;
  const failedCount = Number(failed) || 0;

  return (
    <main className="form-page wide-page">
      <Link className="back-link" href="/">
        ← Профили
      </Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Архив</p>
          <h1>История загрузок</h1>
        </div>
        <Link className="primary-button" href="/imports/new">
          Загрузить файлы
        </Link>
      </div>

      {uploaded !== undefined || failed !== undefined ? (
        <p className={`notice ${failedCount ? "error" : "success"}`}>
          Загружено: {uploadedCount}. С ошибкой: {failedCount}.
        </p>
      ) : null}

      <section className="content-card">
        <ImportList imports={imports} showProfile />
      </section>
    </main>
  );
}
