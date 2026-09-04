import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const password = process.argv[2];

if (!password || password.length < 8) {
  console.error("Укажите пароль длиной не менее 8 символов.");
  console.error("Пример: node scripts/configure-local.mjs 'ваш-пароль'");
  process.exit(1);
}

if (existsSync(".env") && !process.argv.includes("--force")) {
  console.error("Файл .env уже существует. Добавьте --force для замены.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const passwordHash = scryptSync(password, salt, 64).toString("hex");
const sessionSecret = randomBytes(32).toString("hex");

writeFileSync(
  ".env",
  [
    `APP_PASSWORD_HASH=scrypt:${salt}:${passwordHash}`,
    `SESSION_SECRET=${sessionSecret}`,
    "COOKIE_SECURE=false",
    "",
  ].join("\n"),
  { mode: 0o600 },
);

console.log("Локальная конфигурация сохранена в .env.");
