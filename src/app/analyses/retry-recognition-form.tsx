"use client";

export function RetryRecognitionForm({
  action,
}: {
  action: () => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Распознать документ заново? Текущий черновик и несохранённые исправления будут заменены.",
          )
        )
          event.preventDefault();
      }}
    >
      <button type="submit">Распознать заново</button>
    </form>
  );
}
