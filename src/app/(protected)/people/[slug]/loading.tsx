export default function PersonLoading() {
  return (
    <main className="person-page" aria-busy="true" aria-label="Загрузка">
      <div className="skeleton-heading" />
      <div className="table-skeleton">
        <span />
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
