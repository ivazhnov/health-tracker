"use client";

import { useState, useSyncExternalStore } from "react";

export function SourcePanel({
  extractedText,
  mediaType,
  sourceDocumentId,
}: {
  extractedText: string;
  mediaType: string;
  sourceDocumentId: number;
}) {
  const [tab, setTab] = useState<"original" | "text">("original");
  const [collapsed, setCollapsed] = useState(false);
  const [openedOnNarrowScreen, setOpenedOnNarrowScreen] = useState(false);
  const narrowScreen = useSyncExternalStore(
    subscribeToNarrowScreen,
    isNarrowScreen,
    () => false,
  );
  const effectivelyCollapsed =
    collapsed || (narrowScreen && !openedOnNarrowScreen);
  const sourceUrl = `/api/documents/${sourceDocumentId}`;

  return (
    <aside
      className={`source-panel ${effectivelyCollapsed ? "collapsed" : ""}`}
    >
      <div className="source-panel-heading">
        <strong>Источник</strong>
        <div>
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            Открыть ↗
          </a>
          <button
            type="button"
            aria-label={
              effectivelyCollapsed ? "Развернуть источник" : "Свернуть источник"
            }
            onClick={() =>
              narrowScreen
                ? setOpenedOnNarrowScreen((value) => !value)
                : setCollapsed((value) => !value)
            }
          >
            {effectivelyCollapsed ? "Развернуть" : "Свернуть"}
          </button>
        </div>
      </div>
      {!effectivelyCollapsed ? (
        <>
          <div
            className="source-tabs"
            role="tablist"
            aria-label="Вид источника"
          >
            <button
              role="tab"
              aria-selected={tab === "original"}
              className={tab === "original" ? "active" : ""}
              type="button"
              onClick={() => setTab("original")}
            >
              Оригинал
            </button>
            <button
              role="tab"
              aria-selected={tab === "text"}
              className={tab === "text" ? "active" : ""}
              type="button"
              onClick={() => setTab("text")}
            >
              Извлечённый текст
            </button>
          </div>
          <div className="source-panel-body">
            <div hidden={tab !== "original"}>
              {mediaType === "text/plain" ? (
                <pre className="text-document-preview">{extractedText}</pre>
              ) : (
                <object
                  className="document-preview"
                  data={sourceUrl}
                  type={mediaType}
                >
                  <p>
                    Предпросмотр недоступен.{" "}
                    <a href={sourceUrl} target="_blank" rel="noreferrer">
                      Откройте оригинал
                    </a>
                    .
                  </p>
                </object>
              )}
            </div>
            <pre hidden={tab !== "text"} className="text-document-preview">
              {extractedText}
            </pre>
          </div>
        </>
      ) : null}
    </aside>
  );
}

function subscribeToNarrowScreen(notify: () => void) {
  const media = window.matchMedia("(max-width: 900px)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

function isNarrowScreen() {
  return window.matchMedia("(max-width: 900px)").matches;
}
