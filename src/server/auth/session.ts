import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "health_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = {
  expiresAt: number;
  version: 1;
};

export async function createSession() {
  const expiresAt = Date.now() + SESSION_DURATION_SECONDS * 1000;
  const token = signPayload({ expiresAt, version: 1 });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function hasSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifyToken(token) : false;
}

export async function requireSession() {
  if (!(await hasSession())) {
    redirect("/login");
  }
}

function signPayload(payload: SessionPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token: string) {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  const expected = Buffer.from(sign(encodedPayload), "base64url");
  const actual = Buffer.from(signature, "base64url");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;

    return payload.version === 1 &&
      typeof payload.expiresAt === "number" &&
      payload.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function sign(value: string) {
  return createHmac("sha256", requiredEnvironment("SESSION_SECRET"))
    .update(value)
    .digest("base64url");
}

function requiredEnvironment(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
