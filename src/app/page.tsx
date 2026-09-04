import { getApplicationStatus } from "@/server/services";

export const dynamic = "force-dynamic";

export default function Home() {
  const status = getApplicationStatus();

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Семейный архив здоровья</p>
        <h1>Локальный сервер работает</h1>
        <p className="lead">
          Основа приложения готова. База SQLite хранится отдельно от Docker
          image и останется на месте после обновления контейнера.
        </p>
      </section>

      <section className="status-card" aria-labelledby="storage-title">
        <div>
          <p className="status-label" id="storage-title">
            Постоянное хранилище
          </p>
          <p className="status-value">
            <span className="status-dot" aria-hidden="true" />
            Подключено
          </p>
        </div>

        <dl className="status-details">
          <div>
            <dt>Создано</dt>
            <dd>{formatDate(status.createdAt)}</dd>
          </div>
          <div>
            <dt>ID хранилища</dt>
            <dd className="status-id">{status.installationId}</dd>
          </div>
          <div>
            <dt>Версия схемы</dt>
            <dd>{status.schemaVersion}</dd>
          </div>
        </dl>
      </section>

      <p className="next-step">
        Следующий этап — общий вход и профили членов семьи.
      </p>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
