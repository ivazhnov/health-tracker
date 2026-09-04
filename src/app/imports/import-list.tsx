import Link from "next/link";
import type { ImportSession, ImportStatus } from "@/server/imports";

export function ImportList({
  imports,
  showProfile = false,
}: {
  imports: ImportSession[];
  showProfile?: boolean;
}) {
  if (imports.length === 0) {
    return <p className="muted-copy">Загрузок пока нет.</p>;
  }

  return (
    <div className="import-list">
      {imports.map((item) => (
        <Link className="import-row" href={`/imports/${item.id}`} key={item.id}>
          <div className="file-icon" aria-hidden="true">
            {fileKind(item.mediaType)}
          </div>
          <div className="import-main">
            <strong>{item.originalFileName}</strong>
            <span>
              {showProfile ? `${item.profileName} · ` : ""}
              {formatDateTime(item.createdAt)} · {formatSize(item.sizeBytes)}
            </span>
          </div>
          <div className="import-badges">
            {item.duplicateOfImportSessionId ? (
              <span className="badge neutral">Дубликат</span>
            ) : null}
            <span className={`badge status-${item.status}`}>
              {statusLabel(item.status)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function statusLabel(status: ImportStatus) {
  const labels: Record<ImportStatus, string> = {
    uploaded: "Загружен",
    extracting: "Распознаётся",
    needs_review: "Нужно проверить",
    confirmed: "Подтверждён",
    failed: "Ошибка",
  };
  return labels[status];
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function fileKind(mediaType: string) {
  if (mediaType === "application/pdf") return "PDF";
  if (mediaType === "text/plain") return "TXT";
  if (mediaType.startsWith("image/")) return "IMG";
  return "FILE";
}
