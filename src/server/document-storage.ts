import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentStorage } from "@/server/imports";

export function createLocalDocumentStorage(dataDirectory: string): DocumentStorage {
  const documentsDirectory = path.join(dataDirectory, "documents");

  return {
    async save(sha256, contents) {
      const relativePath = path.join("documents", sha256.slice(0, 2), sha256);
      const absolutePath = path.join(dataDirectory, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });

      try {
        await writeFile(absolutePath, contents, { flag: "wx", mode: 0o600 });
      } catch (error) {
        if (!isAlreadyExists(error)) {
          throw error;
        }
      }

      return relativePath;
    },

    async read(storagePath) {
      const absolutePath = path.resolve(dataDirectory, storagePath);
      const expectedRoot = `${path.resolve(documentsDirectory)}${path.sep}`;

      if (!absolutePath.startsWith(expectedRoot)) {
        throw new Error("Document path is outside the data directory");
      }

      return readFile(absolutePath);
    },
  };
}

function isAlreadyExists(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}
