"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { uploadFilesAction } from "@/app/imports/actions";
import { formatSize } from "@/app/imports/import-list";
import { MAX_FILE_SIZE_BYTES, MAX_UPLOAD_FILES } from "@/server/imports";

type SelectedFile = {
  file: File;
  laboratoryName: string;
};

export function UploadForm({
  profileId,
  personSlug,
}: {
  profileId: number;
  personSlug: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

  function replaceFiles(files: File[]) {
    const next = files.slice(0, MAX_UPLOAD_FILES).map((file) => ({
      file,
      laboratoryName: "",
    }));
    setSelectedFiles(next);
    syncInput(next);
  }

  function removeFile(index: number) {
    const next = selectedFiles.filter((_, itemIndex) => itemIndex !== index);
    setSelectedFiles(next);
    syncInput(next);
  }

  function updateLaboratoryName(index: number, laboratoryName: string) {
    setSelectedFiles((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, laboratoryName } : item,
    ));
  }

  function syncInput(next: SelectedFile[]) {
    if (!input.current) return;
    const transfer = new DataTransfer();
    next.forEach(({ file }) => transfer.items.add(file));
    input.current.files = transfer.files;
  }

  const hasOversizedFile = selectedFiles.some(
    ({ file }) => file.size > MAX_FILE_SIZE_BYTES,
  );

  return (
    <form action={uploadFilesAction} className="upload-form">
      <input name="profileId" type="hidden" value={profileId} />
      <input name="redirectSlug" type="hidden" value={personSlug} />
      <div
        className="upload-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          replaceFiles([...event.dataTransfer.files]);
        }}
      >
        <strong>Перетащите файлы сюда</strong>
        <span>или</span>
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={() => input.current?.click()}
        >
          Выбрать файлы
        </button>
        <input
          ref={input}
          accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
          hidden
          multiple
          name="files"
          required
          type="file"
          onChange={(event) => replaceFiles([...(event.target.files ?? [])])}
        />
        <small>
          PDF, PNG, JPEG, TXT · до {MAX_UPLOAD_FILES} файлов · до{" "}
          {MAX_FILE_SIZE_BYTES / (1024 * 1024)} МБ каждый
        </small>
      </div>
      {selectedFiles.length ? (
        <div className="table-surface">
          <table className="data-table upload-table responsive-table">
            <thead>
              <tr>
                <th>Файл</th>
                <th>Лаборатория</th>
                <th>Размер</th>
                <th>Статус</th>
                <th><span className="sr-only">Действия</span></th>
              </tr>
            </thead>
            <tbody>
              {selectedFiles.map(({ file, laboratoryName }, index) => {
                const oversized = file.size > MAX_FILE_SIZE_BYTES;
                return (
                  <tr key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                    <td data-label="Файл"><strong>{file.name}</strong></td>
                    <td data-label="Лаборатория">
                      <label>
                        <span className="sr-only">Лаборатория для {file.name}</span>
                        <input
                          className="table-input"
                          maxLength={200}
                          name="laboratoryNames"
                          placeholder="Определить автоматически"
                          value={laboratoryName}
                          onChange={(event) =>
                            updateLaboratoryName(index, event.target.value)}
                        />
                      </label>
                    </td>
                    <td data-label="Размер">{formatSize(file.size)}</td>
                    <td data-label="Статус">
                      <span className={`status-badge ${oversized ? "status-failed" : "neutral"}`}>
                        {oversized ? "Слишком большой" : "Готов к загрузке"}
                      </span>
                    </td>
                    <td data-label="Действия">
                      <button
                        aria-label={`Убрать ${file.name}`}
                        className="icon-button"
                        type="button"
                        onClick={() => removeFile(index)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <UploadActions
        count={selectedFiles.length}
        disabled={!selectedFiles.length || hasOversizedFile}
        personSlug={personSlug}
      />
    </form>
  );
}

function UploadActions({
  count,
  disabled,
  personSlug,
}: {
  count: number;
  disabled: boolean;
  personSlug: string;
}) {
  const { pending } = useFormStatus();
  const buttonText = pending
    ? "Загружаем и распознаём…"
    : `Загрузить ${count ? `${count} ${fileWord(count)}` : "файлы"}`;

  return (
    <>
      <div className="form-actions">
        <a className="secondary-button" href={`/people/${personSlug}`}>
          {pending ? "Вернуться к профилю" : "Отмена"}
        </a>
        <button
          className="primary-button"
          disabled={disabled || pending}
          type="submit"
        >
          {buttonText}
        </button>
      </div>
      <p aria-live="polite" className="upload-progress">
        {pending
          ? "Загружаем документы и распознаём данные. Можно вернуться к профилю — обработка продолжится."
          : "После загрузки начнётся распознавание."}
      </p>
    </>
  );
}

function fileWord(count: number) {
  if (count === 1) return "файл";
  if (count >= 2 && count <= 4) return "файла";
  return "файлов";
}
