import { scryptSync, timingSafeEqual } from "node:crypto";

export function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, salt, expectedHex] = encodedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !expectedHex) {
    throw new Error("APP_PASSWORD_HASH has an invalid format");
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);

  return expected.length > 0 && timingSafeEqual(actual, expected);
}
