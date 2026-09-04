import Link from "next/link";
import { notFound } from "next/navigation";
import { formatSize, statusLabel } from "@/app/imports/import-list";
import { getImport } from "@/server/services";

type ImportPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ImportPage({ params }: ImportPageProps) {
  const importId = Number((await params).id);
  const item = Number.isInteger(importId) ? getImport(importId) : null;

  if (!item) {
    notFound();
  }

  return (
    <main className="form-page wide-page">
      <Link className="back-link" href="/imports">
        ← История загрузок
      </Link>
      <p className="eyebrow">Сессия #{item.id}</p>
      <h1 className="file-title">{item.originalFileName}</h1>

      <section className="document-layout">
        <div className="content-card document-details">
          <dl>
            <Detail label="Профиль" value={item.profileName} />
            <Detail label="Статус" value={statusLabel(item.status)} />
            <Detail label="Размер" value={formatSize(item.sizeBytes)} />
            <Detail label="Тип" value={item.mediaType} />
            <Detail label="Создана" value={formatDateTime(item.createdAt)} />
            {item.sha256 ? <Detail label="SHA-256" value={item.sha256} mono /> : null}
          </dl>

          {item.duplicateOfImportSessionId ? (
            <p className="duplicate-note">
              Это точная копия файла из сессии{" "}
              <Link href={`/imports/${item.duplicateOfImportSessionId}`}>
                #{item.duplicateOfImportSessionId}
              </Link>
              . Новый оригинал не создавался.
            </p>
          ) : null}

          {item.errorMessage ? (
            <p className="notice error">{item.errorMessage}</p>
          ) : null}

          {item.sourceDocumentId ? (
            <a
              className="primary-button"
              href={`/api/documents/${item.sourceDocumentId}`}
              rel="noreferrer"
              target="_blank"
            >
              Открыть оригинал
            </a>
          ) : null}
        </div>

        <div className="content-card next-stage-card">
          <p className="status-label">Дальше</p>
          <h2>Распознавание</h2>
          <p>
            На следующем этапе здесь появятся извлечённый текст, показатели и
            предупреждения для проверки.
          </p>
        </div>
      </section>
    </main>
  );
}

function Detail({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? "mono-value" : undefined}>{value}</dd>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}
