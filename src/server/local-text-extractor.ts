import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { TextExtractor } from "@/server/recognition";
import { RecognitionError } from "@/server/recognition-service";

const OCR_LANGUAGES = "eng+rus+fra+deu+ita";
const MAX_PDF_PAGES = 20;
const MAX_COMMAND_OUTPUT = 20 * 1024 * 1024;
const execFileAsync = promisify(execFile);

export function createLocalTextExtractor(dataDirectory: string): TextExtractor {
  const workRoot = path.join(dataDirectory, "work");

  return {
    async extract(mediaType, contents) {
      if (mediaType === "text/plain") {
        return decodeText(contents);
      }

      await mkdir(workRoot, { recursive: true });
      const workDirectory = await mkdtemp(path.join(workRoot, "recognition-"));

      try {
        const sourcePath = path.join(workDirectory, "source");
        await writeFile(sourcePath, contents, { mode: 0o600 });

        // Await inside try so finally cannot delete the files while a tool is reading them.
        if (mediaType === "application/pdf") {
          return await extractPdf(sourcePath, workDirectory);
        }

        if (mediaType === "image/png" || mediaType === "image/jpeg") {
          return await extractImage(sourcePath);
        }

        throw new RecognitionError("Этот тип документа пока не распознаётся.");
      } finally {
        await rm(workDirectory, { force: true, recursive: true });
      }
    },
  };
}

async function extractPdf(sourcePath: string, workDirectory: string) {
  const info = await run("pdfinfo", [sourcePath], "Не удалось прочитать PDF.");
  const pageCount = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new RecognitionError("В PDF не удалось определить количество страниц.");
  }
  if (pageCount > MAX_PDF_PAGES) {
    throw new RecognitionError(`В PDF больше ${MAX_PDF_PAGES} страниц.`);
  }

  const embeddedText = await run(
    "pdftotext",
    ["-layout", "-enc", "UTF-8", sourcePath, "-"],
    "Не удалось извлечь текст из PDF.",
  );
  if (meaningfulLength(embeddedText) >= 40) {
    return embeddedText.trim();
  }

  const pagePrefix = path.join(workDirectory, "page");
  await run(
    "pdftoppm",
    ["-png", "-r", "200", sourcePath, pagePrefix],
    "Не удалось подготовить PDF для OCR.",
  );
  const pages = (await readdir(workDirectory))
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort((left, right) => pageNumber(left) - pageNumber(right));

  const texts: string[] = [];
  for (const page of pages) {
    texts.push(await extractImage(path.join(workDirectory, page)));
  }

  return requireText(texts.join("\n\n"));
}

async function extractImage(sourcePath: string) {
  const text = await run(
    "tesseract",
    [sourcePath, "stdout", "-l", OCR_LANGUAGES, "--psm", "6"],
    "OCR не смог прочитать изображение.",
  );
  return requireText(text);
}

function decodeText(contents: Uint8Array) {
  try {
    if (contents[0] === 0xff && contents[1] === 0xfe) {
      return requireText(new TextDecoder("utf-16le", { fatal: true }).decode(contents));
    }
    return requireText(new TextDecoder("utf-8", { fatal: true }).decode(contents));
  } catch {
    throw new RecognitionError("Текстовый файл должен быть в UTF-8 или UTF-16.");
  }
}

function requireText(value: string) {
  const text = value.trim();
  if (!text) {
    throw new RecognitionError("В документе не удалось найти текст.");
  }
  return text;
}

function meaningfulLength(value: string) {
  return value.replace(/\s/g, "").length;
}

function pageNumber(fileName: string) {
  return Number(fileName.match(/(\d+)/)?.[1] ?? 0);
}

async function run(command: string, args: string[], errorMessage: string) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      encoding: "utf8",
      maxBuffer: MAX_COMMAND_OUTPUT,
      timeout: 120_000,
    });
    return stdout;
  } catch {
    throw new RecognitionError(errorMessage);
  }
}
