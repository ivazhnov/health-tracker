"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { uploadFilesAction } from "@/app/imports/actions";
import { formatSize } from "@/app/imports/import-list";
import { MAX_FILE_SIZE_BYTES, MAX_UPLOAD_FILES } from "@/server/imports";

export function UploadForm({ profileId, personSlug }: { profileId: number; personSlug: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  function sync(next: File[]) {
    setFiles(next);
    if (!input.current) return;
    const transfer = new DataTransfer();
    next.forEach((file) => transfer.items.add(file));
    input.current.files = transfer.files;
  }

  const hasOversizedFile = files.some((file) => file.size > MAX_FILE_SIZE_BYTES);

  return <form action={uploadFilesAction} className="upload-form">
    <input name="profileId" type="hidden" value={profileId} />
    <input name="redirectSlug" type="hidden" value={personSlug} />
    <div className="upload-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); sync([...event.dataTransfer.files].slice(0, MAX_UPLOAD_FILES)); }}>
      <strong>Перетащите файлы сюда</strong><span>или</span>
      <button className="secondary-button compact-button" type="button" onClick={() => input.current?.click()}>Выбрать файлы</button>
      <input ref={input} accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" hidden multiple name="files" required type="file" onChange={(event) => sync([...(event.target.files ?? [])].slice(0, MAX_UPLOAD_FILES))} />
      <small>PDF, PNG, JPEG, TXT · до {MAX_UPLOAD_FILES} файлов · до {MAX_FILE_SIZE_BYTES / (1024 * 1024)} МБ каждый</small>
    </div>
    {files.length ? <div className="table-surface"><table className="data-table responsive-table"><thead><tr><th>Файл</th><th>Размер</th><th>Статус</th><th><span className="sr-only">Действия</span></th></tr></thead>
      <tbody>{files.map((file, index) => {
        const oversized = file.size > MAX_FILE_SIZE_BYTES;
        return <tr key={`${file.name}-${file.size}-${index}`}><td data-label="Файл"><strong>{file.name}</strong></td><td data-label="Размер">{formatSize(file.size)}</td><td data-label="Статус"><span className={`status-badge ${oversized ? "status-failed" : "neutral"}`}>{oversized ? "Слишком большой" : "Готов к загрузке"}</span></td><td data-label="Действия"><button className="icon-button" type="button" aria-label={`Убрать ${file.name}`} onClick={() => sync(files.filter((_, itemIndex) => itemIndex !== index))}>×</button></td></tr>;
      })}</tbody></table></div> : null}
    <div className="form-actions"><Link className="secondary-button" href={`/people/${personSlug}`}>Отмена</Link><button className="primary-button" disabled={!files.length || hasOversizedFile} type="submit">Загрузить {files.length ? `${files.length} ${fileWord(files.length)}` : "файлы"}</button></div>
  </form>;
}

function fileWord(count: number) {
  if (count === 1) return "файл";
  if (count >= 2 && count <= 4) return "файла";
  return "файлов";
}
